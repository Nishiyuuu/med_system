import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: {
    type: String,
    enum: [
      'LOGIN',
      'FAILED_LOGIN',
      'VIEW_EHR',
      'CREATE_EHR',
      'UPDATE_EHR',
      'CREATE_PATIENT',
      'UPDATE_PATIENT',
      'CREATE_APPOINTMENT',
      'UPDATE_APPOINTMENT',
      'CREATE_USER',
      'UPDATE_USER',
      'ROLE_CHANGE',
      'EXPORT_DATA'
    ],
    required: true
  },
  description: { type: String, trim: true },
  entity: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  targetPatientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  timestamp: { type: Date, default: Date.now },
  ipAddress: { type: String, required: true }
}, { versionKey: false });

export default mongoose.model('AuditLog', auditLogSchema);
