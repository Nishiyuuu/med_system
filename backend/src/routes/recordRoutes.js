import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { createRecord, getPatientRecords, updateRecord } from '../controllers/recordController.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();
router.use(authenticate);
router.get('/patient/:patientId', authorize('DOCTOR', 'PATIENT'), asyncHandler(getPatientRecords));
router.post('/', authorize('DOCTOR'), asyncHandler(createRecord));
router.put('/:recordId', authorize('DOCTOR'), asyncHandler(updateRecord));
export default router;
