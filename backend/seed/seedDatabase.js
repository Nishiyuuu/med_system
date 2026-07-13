import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Patient from '../src/models/Patient.js';
import Appointment from '../src/models/Appointment.js';
import MedicalRecord from '../src/models/MedicalRecord.js';
import AuditLog from '../src/models/AuditLog.js';

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

const demoPasswords = {
  admin: 'Admin123!',
  doctor: 'Doctor123!',
  receptionist: 'Reception123!',
  patient: 'Patient123!'
};

const collectionCleanupOrder = [
  'auditlogs',
  'medicalrecords',
  'appointments',
  'patients',
  'users',
  'doctors',
  'departments',
  'specializations',
  'visits',
  'schedules'
];

export async function run() {
  assertSafeEnvironment();
  await mongoose.connect(mongoUri);
  assertSafeDatabaseName(mongoose.connection.name);

  const deleted = await clearApplicationCollections();
  const staffUsers = await seedStaffUsers();
  const doctors = staffUsers.filter(user => user.role === 'DOCTOR');
  const patients = await seedPatients(doctors);
  const patientUser = await seedPatientUser(patients[0]);
  const appointments = await seedAppointments(patients, doctors);
  const records = await seedMedicalRecords(appointments);
  const auditLogs = await seedAuditLogs({ users: [...staffUsers, patientUser], patients, appointments, records });

  printReport({
    deleted,
    users: [...staffUsers, patientUser],
    doctors,
    patients,
    appointments,
    records,
    auditLogs
  });
  await mongoose.disconnect();
}

function assertSafeEnvironment() {
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  if (nodeEnv === 'production') {
    throw new Error('Seed przerwany: NODE_ENV=production. Skrypt czyszczący działa tylko w środowisku developerskim lub testowym.');
  }
  if (!mongoUri) {
    throw new Error('Brak MONGO_URI lub MONGODB_URI w zmiennych środowiskowych.');
  }
}

function assertSafeDatabaseName(databaseName) {
  if (/prod|production|live/i.test(databaseName || '')) {
    throw new Error(`Seed przerwany: nazwa bazy "${databaseName}" wygląda jak produkcyjna.`);
  }
}

async function clearApplicationCollections() {
  const existingCollections = await mongoose.connection.db.listCollections().toArray();
  const existingNames = new Set(existingCollections.map(collection => collection.name));
  const deleted = {};

  for (const collectionName of collectionCleanupOrder) {
    if (!existingNames.has(collectionName)) {
      deleted[collectionName] = 0;
      continue;
    }
    const result = await mongoose.connection.db.collection(collectionName).deleteMany({});
    deleted[collectionName] = result.deletedCount || 0;
  }

  return deleted;
}

async function seedStaffUsers() {
  const hashes = {
    admin: await bcrypt.hash(demoPasswords.admin, 12),
    doctor: await bcrypt.hash(demoPasswords.doctor, 12),
    receptionist: await bcrypt.hash(demoPasswords.receptionist, 12)
  };

  return User.insertMany([
    {
      email: 'admin@medcenter.local',
      passwordHash: hashes.admin,
      firstName: 'Adam',
      lastName: 'Administrator',
      role: 'ADMIN',
      isActive: true
    },
    {
      email: 'reception@medcenter.local',
      passwordHash: hashes.receptionist,
      firstName: 'Ewa',
      lastName: 'Recepcjonistka',
      role: 'RECEPTIONIST',
      phone: '+48 500 000 001',
      isActive: true
    },
    doctor('doctor@medcenter.local', 'Jan', 'Nowak', 'lekarz rodzinny', 'PWZ-100001', 'Gabinet 101', '+48 500 000 101', 'pon-pt 08:00-14:00', hashes.doctor),
    doctor('kardiolog@example.local', 'Anna', 'Kowalska', 'kardiolog', 'PWZ-100002', 'Gabinet 102', '+48 500 000 102', 'pon, śr, pt 09:00-15:00', hashes.doctor),
    doctor('dermatolog@example.local', 'Maria', 'Wiśniewska', 'dermatolog', 'PWZ-100003', 'Gabinet 103', '+48 500 000 103', 'wt-czw 10:00-16:00', hashes.doctor),
    doctor('neurolog@example.local', 'Piotr', 'Zieliński', 'neurolog', 'PWZ-100004', 'Gabinet 104', '+48 500 000 104', 'pon, wt, czw 08:30-14:30', hashes.doctor),
    doctor('pediatra@example.local', 'Katarzyna', 'Wójcik', 'pediatra', 'PWZ-100005', 'Gabinet 105', '+48 500 000 105', 'pon-pt 08:00-13:00', hashes.doctor),
    doctor('ortopeda@example.local', 'Tomasz', 'Lewandowski', 'ortopeda', 'PWZ-100006', 'Gabinet 106', '+48 500 000 106', 'pon-pt 12:00-18:00', hashes.doctor)
  ]);
}

async function seedPatientUser(patient) {
  const passwordHash = await bcrypt.hash(demoPasswords.patient, 12);
  return User.create({
    email: 'patient@medcenter.local',
    passwordHash,
    firstName: patient.firstName,
    lastName: patient.lastName,
    role: 'PATIENT',
    patientId: patient._id,
    phone: patient.contact.phone,
    isActive: true
  });
}

async function seedPatients(doctors) {
  const doctorBySpecialization = new Map(doctors.map(item => [item.specialization, item]));
  const rows = [
    ['82030512345', 'Anna', 'Kowalska', '1982-03-05', 'F', 'Warszawa, ul. Kwiatowa 12', 'kardiolog', 'A+', ['Atorwastatyna 20 mg'], [['Nadciśnienie tętnicze', 'I10']], [['Pyłki traw', 'Katar sienny', 'LOW']], 'Pacjentka prowadzi dzienniczek ciśnienia.'],
    ['90071423456', 'Jan', 'Nowak', '1990-07-14', 'M', 'Warszawa, ul. Lipowa 4', 'lekarz rodzinny', '0+', [], [], [], 'Okresowe infekcje górnych dróg oddechowych.'],
    ['75112234567', 'Piotr', 'Zieliński', '1975-11-22', 'M', 'Piaseczno, ul. Leśna 7', 'ortopeda', 'B+', ['Metformina 500 mg'], [['Cukrzyca typu 2', 'E11']], [], 'Zalecana kontrola masy ciała.'],
    ['64020945678', 'Maria', 'Wiśniewska', '1964-02-09', 'F', 'Pruszków, ul. Parkowa 19', 'kardiolog', 'A-', ['Bisoprolol 2,5 mg'], [['Migotanie przedsionków', 'I48']], [], 'Regularne kontrole kardiologiczne.'],
    ['12031934562', 'Filip', 'Witkowski', '2012-03-19', 'M', 'Warszawa, ul. Dobra 5', 'pediatra', 'B+', [], [], [['Penicylina', 'Wysypka', 'HIGH']], 'Częste infekcje sezonowe.'],
    ['93091567890', 'Katarzyna', 'Wójcik', '1993-09-15', 'F', 'Warszawa, ul. Polna 22', 'dermatolog', 'AB+', [], [], [['Nikiel', 'Kontaktowe zapalenie skóry', 'LOW']], 'Nawracające zmiany skórne dłoni.'],
    ['70040778901', 'Tomasz', 'Lewandowski', '1970-04-07', 'M', 'Otwock, ul. Sosnowa 8', 'neurolog', '0-', ['Sumatryptan doraźnie'], [['Migrena', 'G43']], [], 'Migreny 2-3 razy w miesiącu.'],
    ['81043001239', 'Alicja', 'Piotrowska', '1981-04-30', 'F', 'Marki, ul. Słoneczna 10', 'lekarz rodzinny', 'AB-', [], [], [], 'Badania okresowe przed rozpoczęciem pracy.']
  ];

  return Patient.insertMany(rows.map((row, index) => {
    const [pesel, firstName, lastName, dateOfBirth, gender, address, specialization, bloodType, medications, chronicConditions, allergies, medicalNote] = row;
    const primaryDoctor = doctorBySpecialization.get(specialization) || doctors[0];
    return {
      pesel,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      status: 'ACTIVE',
      primaryDoctorId: primaryDoctor._id,
      contact: {
        phone: `+48 600 000 ${String(index + 1).padStart(3, '0')}`,
        email: `${slugify(firstName)}.${slugify(lastName)}@example.local`,
        address
      },
      emergencyContact: {
        name: `Kontakt ${lastName}`,
        phone: `+48 601 000 ${String(index + 1).padStart(3, '0')}`
      },
      bloodType,
      medications,
      medicalNote,
      chronicConditions: chronicConditions.map(([name, icd10Code]) => ({ name, icd10Code })),
      allergies: allergies.map(([substance, reaction, severity]) => ({ substance, reaction, severity }))
    };
  }));
}

async function seedAppointments(patients, doctors) {
  const rows = [
    [patients[0], doctors[1], daysFromNow(-6, 9, 0), 'COMPLETED', 'Konsultacja', 'Kontrola ciśnienia tętniczego'],
    [patients[1], doctors[0], daysFromNow(-3, 10, 30), 'COMPLETED', 'Kontrola', 'Ból gardła i kaszel'],
    [patients[2], doctors[5], daysFromNow(-3, 12, 0), 'CANCELLED', 'Konsultacja', 'Ból kolana po wysiłku'],
    [patients[3], doctors[1], daysFromNow(0, 9, 30), 'SCHEDULED', 'Kontrola', 'Kontrola kardiologiczna'],
    [patients[4], doctors[4], daysFromNow(0, 11, 0), 'SCHEDULED', 'Konsultacja', 'Wizyta pediatryczna'],
    [patients[5], doctors[2], daysFromNow(0, 13, 30), 'COMPLETED', 'Badanie', 'Kontrola zmian skórnych'],
    [patients[0], doctors[0], daysFromNow(1, 8, 30), 'SCHEDULED', 'Konsultacja', 'Badanie profilaktyczne'],
    [patients[1], doctors[1], daysFromNow(1, 9, 0), 'SCHEDULED', 'Kontrola', 'Kontrola ciśnienia'],
    [patients[2], doctors[2], daysFromNow(1, 9, 30), 'SCHEDULED', 'Badanie', 'Zmiany skórne dłoni'],
    [patients[3], doctors[3], daysFromNow(1, 10, 0), 'SCHEDULED', 'Konsultacja', 'Zawroty głowy'],
    [patients[4], doctors[4], daysFromNow(1, 10, 30), 'SCHEDULED', 'Konsultacja', 'Kaszel i gorączka'],
    [patients[5], doctors[5], daysFromNow(1, 11, 0), 'SCHEDULED', 'Kontrola', 'Ból kolana'],
    [patients[6], doctors[3], daysFromNow(2, 8, 30), 'SCHEDULED', 'Konsultacja', 'Migrena i zawroty głowy'],
    [patients[7], doctors[0], daysFromNow(2, 9, 0), 'SCHEDULED', 'Badanie', 'Badanie okresowe'],
    [patients[0], doctors[1], daysFromNow(2, 11, 30), 'COMPLETED', 'Kontrola', 'Kontrola leczenia'],
    [patients[1], doctors[2], daysFromNow(2, 14, 0), 'CANCELLED', 'Badanie', 'Odwołana kontrola skóry'],
    [patients[2], doctors[5], daysFromNow(4, 12, 30), 'SCHEDULED', 'Konsultacja', 'Ból stawu kolanowego'],
    [patients[3], doctors[1], daysFromNow(7, 8, 30), 'SCHEDULED', 'Kontrola', 'Kontrola kardiologiczna'],
    [patients[4], doctors[4], daysFromNow(7, 9, 0), 'SCHEDULED', 'Konsultacja', 'Wizyta pediatryczna'],
    [patients[5], doctors[2], daysFromNow(7, 10, 0), 'SCHEDULED', 'Badanie', 'Kontrola znamion'],
    [patients[6], doctors[3], daysFromNow(7, 11, 0), 'SCHEDULED', 'Konsultacja', 'Ból głowy'],
    [patients[7], doctors[0], daysFromNow(7, 12, 0), 'SCHEDULED', 'Badanie', 'Badania kontrolne']
  ];

  return Appointment.insertMany(rows.map(([patient, doctorDoc, dateTime, status, visitType, reason]) => ({
    patientId: patient._id,
    doctorId: doctorDoc._id,
    dateTime,
    durationMinutes: 30,
    visitType,
    reason,
    status,
    notes: buildAppointmentNote(status, reason)
  })));
}

async function seedMedicalRecords(appointments) {
  const completedAppointments = appointments.filter(item => item.status === 'COMPLETED');
  const templates = [
    ['I10', 'Nadciśnienie tętnicze pierwotne', 'Pacjentka zgłasza okresowe bóle głowy i wyższe wartości ciśnienia wieczorem.', 'Stan ogólny dobry. Tętno miarowe.', 'Domowy pomiar ciśnienia, ograniczenie soli, kontrola za 4 tygodnie.', [{ medicationName: 'Amlodypina', dosage: '5 mg raz dziennie' }], { vitals: { systolicMmHg: 145, diastolicMmHg: 88, pulseBpm: 74 } }],
    ['J06.9', 'Ostra infekcja górnych dróg oddechowych', 'Katar, ból gardła i osłabienie od dwóch dni.', 'Gardło zaczerwienione, osłuchowo bez zmian.', 'Leczenie objawowe, nawodnienie, kontrola w razie pogorszenia.', [{ medicationName: 'Paracetamol', dosage: '500 mg do 3 razy dziennie' }], { vitals: { temperatureC: 37.4, pulseBpm: 86, spo2Percent: 98 } }]
  ];

  return MedicalRecord.insertMany(completedAppointments.map((appointment, index) => {
    const [icd10Code, description, interviewNotes, physicalExamination, recommendations, prescriptions, dynamicResults] = templates[index % templates.length];
    return {
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      appointmentId: appointment._id,
      visitDate: appointment.dateTime,
      diagnosis: { icd10Code, description },
      interviewNotes,
      physicalExamination,
      recommendations,
      prescriptions,
      dynamicResults
    };
  }));
}

async function seedAuditLogs({ users, patients, appointments, records }) {
  const admin = users.find(user => user.role === 'ADMIN');
  const receptionist = users.find(user => user.role === 'RECEPTIONIST');
  const doctorUser = users.find(user => user.email === 'doctor@medcenter.local');
  const patientUser = users.find(user => user.role === 'PATIENT');
  const logs = [
    audit(admin, 'CREATE_USER', 'Utworzono konta demonstracyjne', 'User', admin._id, null, -6),
    audit(receptionist, 'CREATE_PATIENT', `Utworzono kartę pacjenta ${patients[0].lastName} ${patients[0].firstName}`, 'Patient', patients[0]._id, patients[0]._id, -5),
    audit(receptionist, 'CREATE_APPOINTMENT', 'Dodano wizytę w terminarzu', 'Appointment', appointments[0]._id, appointments[0].patientId, -4),
    audit(receptionist, 'UPDATE_APPOINTMENT', 'Zmieniono status wizyty', 'Appointment', appointments[2]._id, appointments[2].patientId, -3),
    audit(doctorUser, 'CREATE_EHR', 'Dodano wpis dokumentacji medycznej', 'MedicalRecord', records[0]._id, records[0].patientId, -2),
    audit(admin, 'LOGIN', 'Logowanie administratora', 'User', admin._id, null, -1),
    audit(doctorUser, 'LOGIN', 'Logowanie lekarza', 'User', doctorUser._id, null, 0),
    audit(patientUser, 'LOGIN', 'Logowanie pacjenta', 'User', patientUser._id, patientUser.patientId, 0)
  ];

  return AuditLog.insertMany(logs);
}

function doctor(email, firstName, lastName, specialization, licenseNumber, office, phone, workingHours, passwordHash) {
  return {
    email,
    passwordHash,
    firstName,
    lastName,
    role: 'DOCTOR',
    specialization,
    licenseNumber,
    phone,
    office,
    workingHours,
    description: `${specialization} z doświadczeniem w pracy ambulatoryjnej. Przyjmuje pacjentów w centrum medycznym.`,
    isActive: true
  };
}

function audit(user, action, description, entity, entityId, targetPatientId, dayOffset) {
  return {
    userId: user?._id,
    action,
    description,
    entity,
    entityId,
    targetPatientId,
    timestamp: daysFromNow(dayOffset, 9 + Math.abs(dayOffset % 6), 15),
    ipAddress: '127.0.0.1'
  };
}

function buildAppointmentNote(status, reason) {
  if (status === 'CANCELLED') return `Wizyta anulowana. Powód zgłoszenia: ${reason}.`;
  if (status === 'COMPLETED') return `Wizyta zakończona. Powód zgłoszenia: ${reason}.`;
  return `Wizyta zaplanowana. Powód zgłoszenia: ${reason}.`;
}

function daysFromNow(dayOffset, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '');
}

function printReport({ deleted, users, doctors, patients, appointments, records, auditLogs }) {
  console.log('\nSeed bazy demonstracyjnej zakończony.');
  console.log('\nWyczyszczone kolekcje:');
  for (const [name, count] of Object.entries(deleted)) {
    console.log(`- ${name}: usunięto ${count}`);
  }
  console.log('\nDodane dane:');
  console.log(`- użytkownicy: ${users.length}`);
  console.log(`- lekarze: ${doctors.length}`);
  console.log(`- pacjenci: ${patients.length}`);
  console.log(`- wizyty: ${appointments.length}`);
  console.log(`- wpisy dokumentacji medycznej: ${records.length}`);
  console.log(`- logi systemowe: ${auditLogs.length}`);
  console.log('\nKonta demo:');
  console.log(`- admin@medcenter.local / ${demoPasswords.admin}`);
  console.log(`- doctor@medcenter.local / ${demoPasswords.doctor}`);
  console.log(`- reception@medcenter.local / ${demoPasswords.receptionist}`);
  console.log(`- patient@medcenter.local / ${demoPasswords.patient}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run()
    .catch(async error => {
      console.error('\nSeed bazy demonstracyjnej przerwany.');
      console.error(error);
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    });
}
