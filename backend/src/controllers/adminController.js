import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { writeAudit } from '../middlewares/audit.js';
import {
  USER_ROLES,
  assertObjectId,
  assertPassword,
  cleanString,
  httpError,
  isNonEmptyString,
  isValidEmail,
  normalizeEmail,
  pickAllowed
} from '../utils/requestValidation.js';

export async function listUsers(_req, res) {
  const users = await User.find()
    .populate('patientId', 'firstName lastName pesel')
    .sort({ lastName: 1, firstName: 1 });
  res.json({ users });
}

export async function createUser(req, res) {
  const staff = validateUserPayload(req.body, { creating: true });
  assertPassword(req.body?.password);

  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await User.create({ ...staff, passwordHash });
  await user.populate('patientId', 'firstName lastName pesel');
  await writeAudit({
    req,
    action: 'CREATE_USER',
    entity: 'User',
    entityId: user._id
  });
  res.status(201).json({ user });
}

export async function updateUser(req, res) {
  assertObjectId(req.params.id, 'Identyfikator użytkownika');

  const allowed = ['firstName', 'lastName', 'role', 'specialization', 'licenseNumber', 'phone', 'patientId', 'isActive'];
  const update = validateUserPayload(pickAllowed(req.body, allowed), { creating: false });
  if (req.params.id === req.user._id.toString() && update.isActive === false) {
    return res.status(400).json({ message: 'Nie możesz dezaktywować własnego konta' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Nie znaleziono użytkownika' });
  const previousRole = user.role;
  Object.assign(user, update);
  validateUserPayload({
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    specialization: user.specialization,
    licenseNumber: user.licenseNumber,
    patientId: user.patientId,
    isActive: user.isActive
  }, { creating: true, requireEmail: false });
  await user.save();
  await user.populate('patientId', 'firstName lastName pesel');
  await writeAudit({
    req,
    action: previousRole !== user.role ? 'ROLE_CHANGE' : 'UPDATE_USER',
    entity: 'User',
    entityId: user._id
  });
  res.json({ user });
}

export async function listAuditLogs(req, res) {
  const limit = clampPositiveInt(req.query.limit, 100, 500);
  const logs = await AuditLog.find()
    .populate('userId', 'firstName lastName email role')
    .sort({ timestamp: -1 })
    .limit(limit);
  res.json({ logs });
}

function clampPositiveInt(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function validateUserPayload(payload, options = {}) {
  payload = payload || {};
  const { creating, requireEmail = creating } = options;
  const user = {};

  if (requireEmail || Object.hasOwn(payload, 'email')) {
    const email = normalizeEmail(payload.email);
    if (!isValidEmail(email)) {
      throw httpError(400, 'Podaj poprawny email pracownika');
    }
    user.email = email;
  }

  if (creating || Object.hasOwn(payload, 'firstName')) {
    user.firstName = cleanString(payload.firstName);
    if (!isNonEmptyString(user.firstName)) {
      throw httpError(400, 'Imię użytkownika jest wymagane');
    }
  }

  if (creating || Object.hasOwn(payload, 'lastName')) {
    user.lastName = cleanString(payload.lastName);
    if (!isNonEmptyString(user.lastName)) {
      throw httpError(400, 'Nazwisko użytkownika jest wymagane');
    }
  }

  if (creating || Object.hasOwn(payload, 'role')) {
    user.role = cleanString(payload.role).toUpperCase();
    if (!USER_ROLES.includes(user.role)) {
      throw httpError(400, 'Nieprawidłowa rola użytkownika');
    }
  }

  if (Object.hasOwn(payload, 'specialization')) {
    user.specialization = cleanString(payload.specialization);
  }

  if (Object.hasOwn(payload, 'licenseNumber')) {
    user.licenseNumber = cleanString(payload.licenseNumber);
  }

  if (Object.hasOwn(payload, 'phone')) {
    user.phone = cleanString(payload.phone);
  }

  if (Object.hasOwn(payload, 'patientId')) {
    const patientId = cleanString(payload.patientId);
    if (patientId) {
      assertObjectId(patientId, 'Identyfikator pacjenta');
      user.patientId = patientId;
    } else {
      user.patientId = null;
    }
  }

  if (Object.hasOwn(payload, 'isActive')) {
    user.isActive = Boolean(payload.isActive);
  }

  const role = user.role || cleanString(payload.role).toUpperCase();
  const licenseNumber = user.licenseNumber ?? payload.licenseNumber;
  const patientId = user.patientId ?? payload.patientId;
  if (role === 'DOCTOR' && !isNonEmptyString(licenseNumber)) {
    throw httpError(400, 'Numer prawa wykonywania zawodu jest wymagany dla lekarza');
  }

  if (role && role !== 'DOCTOR') {
    user.specialization = '';
    user.licenseNumber = '';
  }

  if (role === 'PATIENT' && !patientId) {
    throw httpError(400, 'Konto pacjenta musi być powiązane z kartą pacjenta');
  }

  if (role && role !== 'PATIENT') {
    user.patientId = null;
  }

  return user;
}
