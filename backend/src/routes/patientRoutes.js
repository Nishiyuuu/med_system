import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  archivePatient,
  createPatient,
  getPatient,
  getPatientAppointments,
  getPatientSummary,
  listPatients,
  updatePatient
} from '../controllers/patientController.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();
router.use(authenticate);
router.get('/', authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT'), asyncHandler(listPatients));
router.post('/', authorize('ADMIN', 'RECEPTIONIST'), asyncHandler(createPatient));
router.get('/:id/appointments', authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT'), asyncHandler(getPatientAppointments));
router.get('/:id/summary', authorize('DOCTOR', 'PATIENT'), asyncHandler(getPatientSummary));
router.get('/:id', authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT'), asyncHandler(getPatient));
router.put('/:id', authorize('ADMIN', 'RECEPTIONIST'), asyncHandler(updatePatient));
router.patch('/:id/archive', authorize('ADMIN', 'RECEPTIONIST'), asyncHandler(archivePatient));
export default router;
