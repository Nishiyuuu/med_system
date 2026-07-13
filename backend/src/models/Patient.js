import mongoose from 'mongoose';
import validator from 'validator';

const allergySchema = new mongoose.Schema({
  substance: { type: String, required: true, trim: true },
  reaction: { type: String, trim: true },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' }
}, { _id: false });

const chronicConditionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  icd10Code: { type: String, trim: true }
}, { _id: false });

const patientSchema = new mongoose.Schema({
  pesel: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: [/^\d{11}$/, 'PESEL must contain exactly 11 digits']
  },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true, index: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['ACTIVE', 'ARCHIVED'],
    default: 'ACTIVE',
    index: true
  },
  primaryDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  contact: {
    phone: { type: String, trim: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: value => !value || validator.isEmail(value),
        message: 'Nieprawidłowy adres email'
      }
    },
    address: { type: String, trim: true }
  },
  emergencyContact: {
    name: { type: String, trim: true },
    phone: { type: String, trim: true }
  },
  bloodType: { type: String, trim: true },
  medications: [{ type: String, trim: true }],
  medicalNote: { type: String, trim: true },
  allergies: [allergySchema],
  chronicConditions: [chronicConditionSchema]
}, { timestamps: true });

export default mongoose.model('Patient', patientSchema);
