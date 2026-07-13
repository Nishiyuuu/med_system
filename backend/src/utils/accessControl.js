import Appointment from '../models/Appointment.js';
import { httpError } from './requestValidation.js';

function idsEqual(left, right) {
  return Boolean(left && right && left.toString() === right.toString());
}

export function getUserPatientId(user) {
  if (!user?.patientId) return null;
  return typeof user.patientId === 'object' ? user.patientId._id || user.patientId : user.patientId;
}

export async function canAccessPatient(user, patient) {
  if (!user || !patient) return false;
  if (['ADMIN', 'RECEPTIONIST'].includes(user.role)) return true;
  if (user.role === 'PATIENT') {
    return idsEqual(getUserPatientId(user), patient._id);
  }
  if (user.role === 'DOCTOR') {
    const primaryDoctorId = typeof patient.primaryDoctorId === 'object'
      ? patient.primaryDoctorId?._id
      : patient.primaryDoctorId;
    if (idsEqual(primaryDoctorId, user._id)) return true;
    return Boolean(await Appointment.exists({ patientId: patient._id, doctorId: user._id }));
  }
  return false;
}

export async function assertPatientAccess(req, patient) {
  if (!await canAccessPatient(req.user, patient)) {
    throw httpError(403, 'Brak dostępu do danych pacjenta');
  }
}
