import Patient from '../models/Patient.js';
import MedicalRecord from '../models/MedicalRecord.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { writeAudit } from '../middlewares/audit.js';
import { assertPatientAccess, getUserPatientId } from '../utils/accessControl.js';
import {
  assertObjectId,
  cleanString,
  httpError,
  isNonEmptyString,
  isValidEmail,
  parseDate,
  pickAllowed
} from '../utils/requestValidation.js';

export async function listPatients(req, res) {
  const page = clampPositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = clampPositiveInt(req.query.limit, 20, 100);
  const search = req.query.search?.trim();
  const safeSearch = search ? escapeRegex(search) : '';
  const clauses = [];

  if (search) {
    clauses.push({
      $or: [
        { firstName: { $regex: safeSearch, $options: 'i' } },
        { lastName: { $regex: safeSearch, $options: 'i' } },
        { pesel: { $regex: `^${safeSearch}` } }
      ]
    });
  }

  const status = cleanString(req.query.status || 'ACTIVE').toUpperCase();
  if (status !== 'ALL') {
    if (!['ACTIVE', 'ARCHIVED'].includes(status)) {
      throw httpError(400, 'Nieprawidłowy status pacjenta');
    }
    clauses.push({ status });
  }

  if (req.user.role === 'PATIENT') {
    const patientId = getUserPatientId(req.user);
    if (!patientId) {
      return res.json({ items: [], page, limit, total: 0 });
    }
    clauses.push({ _id: patientId });
  } else if (req.user.role === 'DOCTOR') {
    const appointmentPatientIds = await Appointment.distinct('patientId', { doctorId: req.user._id });
    clauses.push({
      $or: [
        { primaryDoctorId: req.user._id },
        { _id: { $in: appointmentPatientIds } }
      ]
    });
  }

  const filter = clauses.length ? { $and: clauses } : {};
  const [items, total] = await Promise.all([
    Patient.find(filter)
      .populate('primaryDoctorId', 'firstName lastName specialization')
      .sort({ lastName: 1, firstName: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Patient.countDocuments(filter)
  ]);
  res.json({ items, page, limit, total });
}

export async function createPatient(req, res) {
  const payload = validatePatientPayload(req.body, { creating: true });
  await assertPrimaryDoctor(payload.primaryDoctorId);
  const patient = await Patient.create(payload);
  await patient.populate('primaryDoctorId', 'firstName lastName specialization');
  await writeAudit({
    req,
    action: 'CREATE_PATIENT',
    entity: 'Patient',
    entityId: patient._id,
    targetPatientId: patient._id
  });
  res.status(201).json({ patient });
}

export async function getPatient(req, res) {
  assertObjectId(req.params.id, 'Identyfikator pacjenta');
  const patient = await Patient.findById(req.params.id).populate('primaryDoctorId', 'firstName lastName specialization');
  if (!patient) return res.status(404).json({ message: 'Nie znaleziono pacjenta' });
  await assertPatientAccess(req, patient);
  await writeAudit({
    req,
    action: 'VIEW_EHR',
    entity: 'Patient',
    entityId: patient._id,
    targetPatientId: patient._id
  });
  res.json({ patient });
}

export async function updatePatient(req, res) {
  const allowed = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'status', 'primaryDoctorId', 'contact', 'emergencyContact', 'bloodType', 'medications', 'medicalNote', 'allergies', 'chronicConditions'];
  assertObjectId(req.params.id, 'Identyfikator pacjenta');
  const update = validatePatientPayload(pickAllowed(req.body, allowed), { creating: false });
  await assertPrimaryDoctor(update.primaryDoctorId);
  const patient = await Patient.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
    .populate('primaryDoctorId', 'firstName lastName specialization');
  if (!patient) return res.status(404).json({ message: 'Nie znaleziono pacjenta' });
  await writeAudit({
    req,
    action: 'UPDATE_PATIENT',
    entity: 'Patient',
    entityId: patient._id,
    targetPatientId: patient._id
  });
  res.json({ patient });
}

export async function archivePatient(req, res) {
  assertObjectId(req.params.id, 'Identyfikator pacjenta');
  const patient = await Patient.findByIdAndUpdate(
    req.params.id,
    { status: 'ARCHIVED' },
    { new: true, runValidators: true }
  ).populate('primaryDoctorId', 'firstName lastName specialization');
  if (!patient) return res.status(404).json({ message: 'Nie znaleziono pacjenta' });
  await writeAudit({
    req,
    action: 'UPDATE_PATIENT',
    entity: 'Patient',
    entityId: patient._id,
    targetPatientId: patient._id
  });
  res.json({ patient });
}

export async function getPatientAppointments(req, res) {
  assertObjectId(req.params.id, 'Identyfikator pacjenta');
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ message: 'Nie znaleziono pacjenta' });
  await assertPatientAccess(req, patient);

  const filter = { patientId: patient._id };
  if (req.user.role === 'DOCTOR') {
    filter.doctorId = req.user._id;
  }

  const appointments = await Appointment.find(filter)
    .populate('doctorId', 'firstName lastName specialization')
    .populate('patientId', 'firstName lastName pesel')
    .sort({ dateTime: -1 });

  res.json({ appointments });
}

export async function getPatientSummary(req, res) {
  assertObjectId(req.params.id, 'Identyfikator pacjenta');
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ message: 'Nie znaleziono pacjenta' });
  await assertPatientAccess(req, patient);

  const records = await MedicalRecord.find({ patientId: patient._id })
    .populate('doctorId', 'firstName lastName specialization')
    .sort({ visitDate: -1 });

  await writeAudit({
    req,
    action: 'EXPORT_DATA',
    entity: 'Patient',
    entityId: patient._id,
    targetPatientId: patient._id
  });

  res.json({
    patient,
    summary: {
      latestVisit: records[0] || null,
      records,
      prescriptions: records.flatMap(record => (record.prescriptions || []).map(item => {
        const prescription = typeof item.toObject === 'function' ? item.toObject() : item;
        return {
          ...prescription,
          visitDate: record.visitDate,
          doctor: record.doctorId
        };
      }))
    }
  });
}

function clampPositiveInt(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validatePatientPayload(payload, { creating }) {
  const patient = {};
  payload = payload || {};

  if (creating) {
    patient.pesel = cleanString(payload.pesel);
    if (!/^\d{11}$/.test(patient.pesel)) {
      throw httpError(400, 'PESEL musi zawierać dokładnie 11 cyfr');
    }
  }

  if (creating || Object.hasOwn(payload, 'firstName')) {
    patient.firstName = cleanString(payload.firstName);
    if (!isNonEmptyString(patient.firstName)) {
      throw httpError(400, 'Imię pacjenta jest wymagane');
    }
  }

  if (creating || Object.hasOwn(payload, 'lastName')) {
    patient.lastName = cleanString(payload.lastName);
    if (!isNonEmptyString(patient.lastName)) {
      throw httpError(400, 'Nazwisko pacjenta jest wymagane');
    }
  }

  if (creating || Object.hasOwn(payload, 'dateOfBirth')) {
    patient.dateOfBirth = parseDate(payload.dateOfBirth, 'Data urodzenia');
  }

  if (creating || Object.hasOwn(payload, 'gender')) {
    patient.gender = cleanString(payload.gender);
    if (!isNonEmptyString(patient.gender)) {
      throw httpError(400, 'Płeć pacjenta jest wymagana');
    }
  }

  if (Object.hasOwn(payload, 'status')) {
    patient.status = cleanString(payload.status || 'ACTIVE').toUpperCase();
    if (!['ACTIVE', 'ARCHIVED'].includes(patient.status)) {
      throw httpError(400, 'Nieprawidłowy status pacjenta');
    }
  }

  if (Object.hasOwn(payload, 'primaryDoctorId')) {
    const primaryDoctorId = cleanString(payload.primaryDoctorId);
    if (primaryDoctorId) {
      assertObjectId(primaryDoctorId, 'Identyfikator lekarza prowadzącego');
      patient.primaryDoctorId = primaryDoctorId;
    } else {
      patient.primaryDoctorId = null;
    }
  }

  if (Object.hasOwn(payload, 'contact')) {
    patient.contact = normalizeContact(payload.contact);
  }

  if (Object.hasOwn(payload, 'emergencyContact')) {
    patient.emergencyContact = normalizeEmergencyContact(payload.emergencyContact);
  }

  if (Object.hasOwn(payload, 'bloodType')) {
    patient.bloodType = cleanString(payload.bloodType);
  }

  if (Object.hasOwn(payload, 'medications')) {
    if (!Array.isArray(payload.medications)) {
      throw httpError(400, 'Przyjmowane leki muszą być listą');
    }
    patient.medications = payload.medications.map(cleanString).filter(Boolean);
  }

  if (Object.hasOwn(payload, 'medicalNote')) {
    patient.medicalNote = cleanString(payload.medicalNote);
  }

  if (Object.hasOwn(payload, 'allergies')) {
    patient.allergies = normalizeAllergies(payload.allergies);
  }

  if (Object.hasOwn(payload, 'chronicConditions')) {
    patient.chronicConditions = normalizeChronicConditions(payload.chronicConditions);
  }

  return patient;
}

async function assertPrimaryDoctor(primaryDoctorId) {
  if (!primaryDoctorId) return;
  const doctor = await User.findOne({ _id: primaryDoctorId, role: 'DOCTOR', isActive: true });
  if (!doctor) {
    throw httpError(400, 'Wybrany lekarz prowadzący nie istnieje lub nie jest aktywny');
  }
}

function normalizeContact(contact = {}) {
  const normalized = {
    phone: cleanString(contact.phone),
    email: cleanString(contact.email).toLowerCase(),
    address: cleanString(contact.address)
  };

  if (normalized.email && !isValidEmail(normalized.email)) {
    throw httpError(400, 'Nieprawidłowy email pacjenta');
  }

  return normalized;
}

function normalizeEmergencyContact(contact = {}) {
  return {
    name: cleanString(contact.name),
    phone: cleanString(contact.phone)
  };
}

function normalizeAllergies(allergies) {
  if (!Array.isArray(allergies)) {
    throw httpError(400, 'Alergie muszą być listą');
  }

  return allergies.map(item => {
    const allergy = {
      substance: cleanString(item?.substance),
      reaction: cleanString(item?.reaction),
      severity: cleanString(item?.severity || 'LOW').toUpperCase()
    };
    if (!isNonEmptyString(allergy.substance)) {
      throw httpError(400, 'Nazwa alergenu jest wymagana');
    }
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(allergy.severity)) {
      throw httpError(400, 'Nieprawidłowy poziom alergii');
    }
    return allergy;
  });
}

function normalizeChronicConditions(conditions) {
  if (!Array.isArray(conditions)) {
    throw httpError(400, 'Choroby przewlekłe muszą być listą');
  }

  return conditions.map(item => {
    const condition = {
      name: cleanString(item?.name),
      icd10Code: cleanString(item?.icd10Code).toUpperCase()
    };
    if (!isNonEmptyString(condition.name)) {
      throw httpError(400, 'Nazwa choroby przewlekłej jest wymagana');
    }
    return condition;
  });
}
