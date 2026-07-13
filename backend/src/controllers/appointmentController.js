import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import { writeAudit } from '../middlewares/audit.js';
import { getUserPatientId } from '../utils/accessControl.js';
import {
  APPOINTMENT_STATUSES,
  assertObjectId,
  cleanString,
  httpError,
  parseDate
} from '../utils/requestValidation.js';

const MIN_APPOINTMENT_DURATION_MINUTES = 5;
const MAX_APPOINTMENT_DURATION_MINUTES = 240;
const OPENING_HOUR = 8;
const CLOSING_HOUR = 16;

function endAt(date, durationMinutes) {
  return new Date(new Date(date).getTime() + durationMinutes * 60 * 1000);
}

export async function listAppointments(req, res) {
  const filter = {};
  if (req.user.role === 'PATIENT') {
    const patientId = getUserPatientId(req.user);
    if (!patientId) return res.json({ items: [] });
    filter.patientId = patientId;
    if (req.query.doctorId) {
      assertObjectId(req.query.doctorId, 'Identyfikator lekarza');
      filter.doctorId = req.query.doctorId;
    }
  } else if (req.user.role === 'DOCTOR') {
    filter.doctorId = req.user._id;
  } else if (req.query.doctorId) {
    assertObjectId(req.query.doctorId, 'Identyfikator lekarza');
    filter.doctorId = req.query.doctorId;
  }
  if (req.query.status) {
    const status = cleanString(req.query.status).toUpperCase();
    if (!APPOINTMENT_STATUSES.includes(status)) {
      throw httpError(400, 'Nieprawidłowy status wizyty');
    }
    filter.status = status;
  }
  const startDate = req.query.startDate || req.query.from;
  const endDate = req.query.endDate || req.query.to;
  if (startDate || endDate) {
    filter.dateTime = {};
    if (startDate) filter.dateTime.$gte = parseDate(startDate, 'Data początku zakresu');
    if (endDate) filter.dateTime.$lte = parseDate(endDate, 'Data końca zakresu');
  }
  const items = await Appointment.find(filter)
    .populate('patientId', 'firstName lastName pesel')
    .populate('doctorId', 'firstName lastName specialization')
    .sort({ dateTime: 1 });
  res.json({ items });
}

export async function listDoctors(_req, res) {
  const doctors = await User.find({ role: 'DOCTOR', isActive: true })
    .select('firstName lastName specialization licenseNumber phone office description workingHours')
    .sort({ lastName: 1, firstName: 1 });
  res.json({ doctors });
}

export async function listAvailability(req, res) {
  const { doctorId, date } = req.query;
  const durationMinutes = parseDuration(req.query.durationMinutes);
  if (!doctorId || !date) {
    return res.status(400).json({ message: 'doctorId i date są wymagane' });
  }
  assertObjectId(doctorId, 'Identyfikator lekarza');
  if (!durationMinutes) {
    return res.status(400).json({ message: 'Czas trwania wizyty musi wynosić od 5 do 240 minut' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: 'Nieprawidłowa data' });
  }

  const doctor = await User.findOne({ _id: doctorId, role: 'DOCTOR', isActive: true });
  if (!doctor) return res.status(404).json({ message: 'Nie znaleziono lekarza' });

  const dayStart = new Date(`${date}T${String(OPENING_HOUR).padStart(2, '0')}:00:00`);
  const dayEnd = new Date(`${date}T${String(CLOSING_HOUR).padStart(2, '0')}:00:00`);
  if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
    return res.status(400).json({ message: 'Nieprawidłowa data' });
  }

  const appointments = await Appointment.find({
    doctorId,
    status: 'SCHEDULED',
    dateTime: {
      $gte: new Date(dayStart.getTime() - MAX_APPOINTMENT_DURATION_MINUTES * 60 * 1000),
      $lt: dayEnd
    }
  });

  const slots = [];
  for (let cursor = new Date(dayStart); endAt(cursor, durationMinutes) <= dayEnd; cursor = endAt(cursor, durationMinutes)) {
    const slotEnd = endAt(cursor, durationMinutes);
    const available = !appointments.some(item => item.dateTime < slotEnd && endAt(item.dateTime, item.durationMinutes) > cursor);
    slots.push({
      start: cursor.toISOString(),
      end: slotEnd.toISOString(),
      available
    });
  }

  res.json({ slots });
}

export async function createAppointment(req, res) {
  const { doctorId, patientId, dateTime } = req.body || {};
  if (!patientId || !doctorId || !dateTime) {
    return res.status(400).json({ message: 'patientId, doctorId i dateTime są wymagane' });
  }
  assertObjectId(patientId, 'Identyfikator pacjenta');
  assertObjectId(doctorId, 'Identyfikator lekarza');
  const durationMinutes = parseDuration(req.body.durationMinutes);
  const start = new Date(dateTime);
  if (Number.isNaN(start.getTime())) {
    return res.status(400).json({ message: 'Nieprawidłowa data wizyty' });
  }
  if (!durationMinutes) {
    return res.status(400).json({ message: 'Czas trwania wizyty musi wynosić od 5 do 240 minut' });
  }
  const [patient, doctor] = await Promise.all([
    Patient.findById(patientId),
    User.findOne({ _id: doctorId, role: 'DOCTOR', isActive: true })
  ]);
  if (!patient) return res.status(404).json({ message: 'Nie znaleziono pacjenta' });
  if (!doctor) return res.status(404).json({ message: 'Nie znaleziono lekarza' });
  const end = endAt(start, durationMinutes);
  const conflicts = await Appointment.find({
    doctorId,
    status: 'SCHEDULED',
    dateTime: {
      $gte: new Date(start.getTime() - MAX_APPOINTMENT_DURATION_MINUTES * 60 * 1000),
      $lt: end
    }
  });
  const hasConflict = conflicts.some(item => endAt(item.dateTime, item.durationMinutes) > start);
  if (hasConflict) {
    return res.status(409).json({ message: 'Lekarz ma już wizytę w tym czasie' });
  }
  const appointment = await Appointment.create({
    patientId,
    doctorId,
    dateTime: start,
    durationMinutes,
    visitType: cleanString(req.body.visitType) || 'Konsultacja',
    reason: cleanString(req.body.reason),
    cost: req.body.cost === undefined || req.body.cost === '' ? undefined : Number(req.body.cost),
    notes: cleanString(req.body.notes)
  });
  await appointment.populate('patientId', 'firstName lastName pesel');
  await appointment.populate('doctorId', 'firstName lastName specialization');
  await writeAudit({
    req,
    action: 'CREATE_APPOINTMENT',
    entity: 'Appointment',
    entityId: appointment._id,
    targetPatientId: appointment.patientId?._id || appointment.patientId
  });
  res.status(201).json({ appointment });
}

export async function updateAppointmentStatus(req, res) {
  assertObjectId(req.params.id, 'Identyfikator wizyty');
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) return res.status(404).json({ message: 'Nie znaleziono wizyty' });
  if (req.user.role === 'DOCTOR' && !appointment.doctorId.equals(req.user._id)) {
    return res.status(403).json({ message: 'Lekarz może aktualizować tylko własne wizyty' });
  }
  const status = cleanString(req.body?.status).toUpperCase();
  if (!APPOINTMENT_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Nieprawidłowy status wizyty' });
  }
  appointment.status = status;
  await appointment.save();
  await appointment.populate('patientId', 'firstName lastName pesel');
  await appointment.populate('doctorId', 'firstName lastName specialization');
  await writeAudit({
    req,
    action: 'UPDATE_APPOINTMENT',
    entity: 'Appointment',
    entityId: appointment._id,
    targetPatientId: appointment.patientId?._id || appointment.patientId
  });
  res.json({ appointment });
}

function parseDuration(value) {
  if (value === undefined || value === null || value === '') return 30;
  const duration = Number(value);
  if (
    !Number.isInteger(duration) ||
    duration < MIN_APPOINTMENT_DURATION_MINUTES ||
    duration > MAX_APPOINTMENT_DURATION_MINUTES
  ) {
    return null;
  }
  return duration;
}
