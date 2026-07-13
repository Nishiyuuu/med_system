import mongoose from 'mongoose';
import validator from 'validator';

export const USER_ROLES = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT'];
export const APPOINTMENT_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];

export function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function assertObjectId(value, label = 'Identyfikator') {
  if (!mongoose.Types.ObjectId.isValid(String(value || ''))) {
    throw httpError(400, `${label} jest nieprawidłowy`);
  }
}

export function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isNonEmptyString(value) {
  return cleanString(value).length > 0;
}

export function isValidEmail(value) {
  const email = cleanString(value);
  return email.length > 0 && validator.isEmail(email);
}

export function normalizeEmail(value) {
  return cleanString(value).toLowerCase();
}

export function assertPassword(value, label = 'Hasło') {
  if (typeof value !== 'string' || value.length < 8) {
    throw httpError(400, `${label} musi mieć co najmniej 8 znaków`);
  }
}

export function pickAllowed(source, allowedFields) {
  return Object.fromEntries(
    Object.entries(source || {}).filter(([key]) => allowedFields.includes(key))
  );
}

export function parseDate(value, label = 'Data') {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw httpError(400, `${label} jest nieprawidłowa`);
  }
  return date;
}
