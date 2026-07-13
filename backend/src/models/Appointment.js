import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  dateTime: { type: Date, required: true, index: true },
  durationMinutes: { type: Number, default: 30, min: 5 },
  visitType: { type: String, trim: true, default: 'Konsultacja' },
  reason: { type: String, trim: true },
  status: {
    type: String,
    enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED'],
    default: 'SCHEDULED'
  },
  cost: { type: Number, min: 0 },
  notes: { type: String, trim: true }
}, { timestamps: true });

appointmentSchema.index({ doctorId: 1, dateTime: 1 });

export default mongoose.model('Appointment', appointmentSchema);
