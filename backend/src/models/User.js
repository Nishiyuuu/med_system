import mongoose from 'mongoose';
import validator from 'validator';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Nieprawidłowy adres email']
  },
  passwordHash: { type: String, required: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  role: {
    type: String,
    required: true,
    enum: ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT']
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required() {
      return this.role === 'PATIENT';
    }
  },
  specialization: { type: String, trim: true },
  phone: { type: String, trim: true },
  licenseNumber: {
    type: String,
    trim: true,
    required() {
      return this.role === 'DOCTOR';
    }
  },
  office: { type: String, trim: true },
  description: { type: String, trim: true },
  workingHours: { type: String, trim: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('User', userSchema);
