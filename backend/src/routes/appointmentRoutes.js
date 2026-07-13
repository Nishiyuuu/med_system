import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { createAppointment, listAppointments, listAvailability, listDoctors, updateAppointmentStatus } from '../controllers/appointmentController.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();
router.use(authenticate);
router.get('/doctors', authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT'), asyncHandler(listDoctors));
router.get('/availability', authorize('ADMIN', 'RECEPTIONIST'), asyncHandler(listAvailability));
router.get('/', authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT'), asyncHandler(listAppointments));
router.post('/', authorize('ADMIN', 'RECEPTIONIST'), asyncHandler(createAppointment));
router.patch('/:id/status', authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), asyncHandler(updateAppointmentStatus));
export default router;
