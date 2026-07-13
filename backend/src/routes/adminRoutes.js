import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { createUser, listAuditLogs, listUsers, updateUser } from '../controllers/adminController.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();
router.use(authenticate, authorize('ADMIN'));
router.get('/users', asyncHandler(listUsers));
router.post('/users', asyncHandler(createUser));
router.patch('/users/:id', asyncHandler(updateUser));
router.get('/audit-logs', asyncHandler(listAuditLogs));
export default router;
