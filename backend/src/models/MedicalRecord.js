import mongoose from 'mongoose';

const prescriptionSchema = new mongoose.Schema({
  medicationName: { type: String, required: true, trim: true },
  dosage: { type: String, required: true, trim: true }
}, { _id: false });

const medicalRecordSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  visitDate: { type: Date, default: Date.now },
  diagnosis: {
    icd10Code: { type: String, trim: true },
    description: { type: String, required: true, trim: true }
  },
  interviewNotes: { type: String, trim: true },
  physicalExamination: { type: String, trim: true },
  recommendations: { type: String, trim: true },
  prescriptions: [prescriptionSchema],
  dynamicResults: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export default mongoose.model('MedicalRecord', medicalRecordSchema);
