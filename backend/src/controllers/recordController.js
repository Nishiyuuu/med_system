import MedicalRecord from '../models/MedicalRecord.js';
import Patient from '../models/Patient.js';
import { writeAudit } from '../middlewares/audit.js';
import { assertPatientAccess } from '../utils/accessControl.js';
import { assertObjectId, cleanString, httpError, isNonEmptyString, pickAllowed } from '../utils/requestValidation.js';

export async function getPatientRecords(req, res) {
  assertObjectId(req.params.patientId, 'Identyfikator pacjenta');
  const patient = await Patient.findById(req.params.patientId);
  if (!patient) return res.status(404).json({ message: 'Nie znaleziono pacjenta' });
  await assertPatientAccess(req, patient);

  const records = await MedicalRecord.find({ patientId: req.params.patientId })
    .populate('doctorId', 'firstName lastName specialization')
    .sort({ visitDate: -1 });
  await writeAudit({
    req,
    action: 'VIEW_EHR',
    entity: 'MedicalRecord',
    entityId: req.params.patientId,
    targetPatientId: req.params.patientId
  });
  res.json({ records });
}

export async function createRecord(req, res) {
  if (!req.body.patientId) {
    return res.status(400).json({ message: 'patientId jest wymagane' });
  }
  assertObjectId(req.body.patientId, 'Identyfikator pacjenta');
  const recordPayload = validateRecordPayload(req.body, { creating: true });

  const patient = await Patient.findById(req.body.patientId);
  if (!patient) return res.status(404).json({ message: 'Nie znaleziono pacjenta' });
  await assertPatientAccess(req, patient);

  const record = await MedicalRecord.create({ ...recordPayload, patientId: req.body.patientId, doctorId: req.user._id });
  await record.populate('doctorId', 'firstName lastName specialization');
  await writeAudit({
    req,
    action: 'CREATE_EHR',
    entity: 'MedicalRecord',
    entityId: record._id,
    targetPatientId: record.patientId
  });
  res.status(201).json({ record });
}

export async function updateRecord(req, res) {
  assertObjectId(req.params.recordId, 'Identyfikator wpisu');
  const record = await MedicalRecord.findById(req.params.recordId);
  if (!record) return res.status(404).json({ message: 'Nie znaleziono wpisu' });
  const ageMs = Date.now() - record.createdAt.getTime();
  const within24Hours = ageMs <= 24 * 60 * 60 * 1000;
  if (!record.doctorId.equals(req.user._id) || !within24Hours) {
    return res.status(403).json({ message: 'Wpis może edytować tylko autor w ciągu 24 godzin' });
  }
  const allowed = ['diagnosis', 'interviewNotes', 'physicalExamination', 'recommendations', 'prescriptions', 'dynamicResults'];
  Object.assign(record, validateRecordPayload(pickAllowed(req.body, allowed), { creating: false }));
  await record.save();
  await record.populate('doctorId', 'firstName lastName specialization');
  await writeAudit({
    req,
    action: 'UPDATE_EHR',
    entity: 'MedicalRecord',
    entityId: record._id,
    targetPatientId: record.patientId
  });
  res.json({ record });
}

function validateRecordPayload(payload, { creating }) {
  payload = payload || {};
  const record = {};

  if (creating || Object.hasOwn(payload, 'diagnosis')) {
    const diagnosis = payload.diagnosis || {};
    record.diagnosis = {
      icd10Code: cleanString(diagnosis.icd10Code).toUpperCase(),
      description: cleanString(diagnosis.description)
    };
    if (!isNonEmptyString(record.diagnosis.description)) {
      throw httpError(400, 'Opis rozpoznania jest wymagany');
    }
  }

  for (const field of ['interviewNotes', 'physicalExamination', 'recommendations']) {
    if (Object.hasOwn(payload, field)) {
      record[field] = cleanString(payload[field]);
    }
  }

  if (Object.hasOwn(payload, 'prescriptions')) {
    if (!Array.isArray(payload.prescriptions)) {
      throw httpError(400, 'Leki muszą być listą');
    }
    record.prescriptions = payload.prescriptions.map(item => {
      const prescription = {
        medicationName: cleanString(item?.medicationName),
        dosage: cleanString(item?.dosage)
      };
      if (!isNonEmptyString(prescription.medicationName) || !isNonEmptyString(prescription.dosage)) {
        throw httpError(400, 'Nazwa leku i dawkowanie są wymagane');
      }
      return prescription;
    });
  }

  if (Object.hasOwn(payload, 'dynamicResults')) {
    if (payload.dynamicResults && typeof payload.dynamicResults !== 'object') {
      throw httpError(400, 'Wyniki dynamiczne muszą być obiektem');
    }
    record.dynamicResults = payload.dynamicResults || {};
  }

  return record;
}
