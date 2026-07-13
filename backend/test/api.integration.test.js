import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb } from '../src/config/db.js';
import User from '../src/models/User.js';
import Patient from '../src/models/Patient.js';
import Appointment from '../src/models/Appointment.js';
import MedicalRecord from '../src/models/MedicalRecord.js';
import AuditLog from '../src/models/AuditLog.js';

let app;
let mongoServer;
let doctor;
let secondDoctor;
let receptionist;
let patient;

test.before(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.CLIENT_URL = 'http://localhost:3000';
  mongoServer = await MongoMemoryServer.create();
  await connectDb(mongoServer.getUri());
  ({ default: app } = await import('../src/app.js'));
});

test.after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test.beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Patient.deleteMany({}),
    Appointment.deleteMany({}),
    MedicalRecord.deleteMany({}),
    AuditLog.deleteMany({})
  ]);

  const passwordHash = await bcrypt.hash('Demo1234!', 10);
  [doctor, secondDoctor, receptionist] = await User.create([
    {
      email: 'doctor.one@test.local',
      passwordHash,
      firstName: 'Jan',
      lastName: 'Lekarz',
      role: 'DOCTOR',
      specialization: 'Cardiology',
      licenseNumber: 'PWZ-1'
    },
    {
      email: 'doctor.two@test.local',
      passwordHash,
      firstName: 'Anna',
      lastName: 'Lekarz',
      role: 'DOCTOR',
      specialization: 'Family Medicine',
      licenseNumber: 'PWZ-2'
    },
    {
      email: 'reception@test.local',
      passwordHash,
      firstName: 'Ewa',
      lastName: 'Recepcja',
      role: 'RECEPTIONIST'
    }
  ]);

  patient = await Patient.create({
    pesel: '90010112345',
    firstName: 'Piotr',
    lastName: 'Pacjent',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'M',
    primaryDoctorId: doctor._id,
    contact: { phone: '123456789' }
  });
});

test('logowanie ustawia token CSRF i ciasteczka sesji', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: receptionist.email, password: 'Demo1234!' })
    .expect(200);

  assert.equal(typeof response.body.csrfToken, 'string');
  assert.equal(response.body.token, undefined);
  assert.match(response.headers['set-cookie'].join(';'), /accessToken=/);
  assert.match(response.headers['set-cookie'].join(';'), /csrfToken=/);
});

test('logowanie odrzuca niepoprawny format danych', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'niepoprawny-email', password: '' })
    .expect(400);

  assert.equal(response.body.message, 'Podaj poprawny email i hasło');
});

test('żądanie mutujące z sesją cookie wymaga tokenu CSRF', async () => {
  const agent = request.agent(app);
  const login = await loginAs(agent, receptionist.email);

  await agent
    .post('/api/patients')
    .send(newPatientPayload('80010112345'))
    .expect(403);

  await agent
    .post('/api/patients')
    .set('X-CSRF-Token', login.body.csrfToken)
    .send(newPatientPayload('80010112345'))
    .expect(201);
});

test('backend blokuje podwójne rezerwacje lekarza', async () => {
  const agent = request.agent(app);
  const login = await loginAs(agent, receptionist.email);
  const dateTime = new Date('2026-05-20T09:00:00.000Z').toISOString();

  await agent
    .post('/api/appointments')
    .set('X-CSRF-Token', login.body.csrfToken)
    .send({
      patientId: patient._id,
      doctorId: doctor._id,
      dateTime,
      durationMinutes: 30
    })
    .expect(201);

  const response = await agent
    .post('/api/appointments')
    .set('X-CSRF-Token', login.body.csrfToken)
    .send({
      patientId: patient._id,
      doctorId: doctor._id,
      dateTime: new Date('2026-05-20T09:15:00.000Z').toISOString(),
      durationMinutes: 30
    })
    .expect(409);

  assert.equal(response.body.message, 'Lekarz ma już wizytę w tym czasie');
});

test('lekarz nie może zaktualizować wizyty innego lekarza', async () => {
  const appointment = await Appointment.create({
    patientId: patient._id,
    doctorId: secondDoctor._id,
    dateTime: new Date('2026-05-21T09:00:00.000Z')
  });

  const agent = request.agent(app);
  const login = await loginAs(agent, doctor.email);

  const response = await agent
    .patch(`/api/appointments/${appointment._id}/status`)
    .set('X-CSRF-Token', login.body.csrfToken)
    .send({ status: 'COMPLETED' })
    .expect(403);

  assert.equal(response.body.message, 'Lekarz może aktualizować tylko własne wizyty');
});

test('status wizyty musi mieć dozwoloną wartość', async () => {
  const appointment = await Appointment.create({
    patientId: patient._id,
    doctorId: doctor._id,
    dateTime: new Date('2026-05-21T09:00:00.000Z')
  });

  const agent = request.agent(app);
  const login = await loginAs(agent, doctor.email);

  const response = await agent
    .patch(`/api/appointments/${appointment._id}/status`)
    .set('X-CSRF-Token', login.body.csrfToken)
    .send({ status: 'DONE' })
    .expect(400);

  assert.equal(response.body.message, 'Nieprawidłowy status wizyty');
});

test('autor może edytować własny wpis EHR w ciągu 24 godzin', async () => {
  const record = await MedicalRecord.create({
    patientId: patient._id,
    doctorId: doctor._id,
    diagnosis: { icd10Code: 'I10', description: 'Nadciśnienie tętnicze' }
  });

  const agent = request.agent(app);
  const login = await loginAs(agent, doctor.email);

  const response = await agent
    .put(`/api/records/${record._id}`)
    .set('X-CSRF-Token', login.body.csrfToken)
    .send({
      recommendations: 'Kontynuować leczenie'
    })
    .expect(200);

  assert.equal(response.body.record.recommendations, 'Kontynuować leczenie');
});

test('nie można utworzyć wpisu EHR dla nieistniejącego pacjenta', async () => {
  const agent = request.agent(app);
  const login = await loginAs(agent, doctor.email);
  const missingPatientId = new mongoose.Types.ObjectId();

  const response = await agent
    .post('/api/records')
    .set('X-CSRF-Token', login.body.csrfToken)
    .send({
      patientId: missingPatientId,
      diagnosis: { icd10Code: 'Z00.0', description: 'Badanie profilaktyczne' }
    })
    .expect(404);

  assert.equal(response.body.message, 'Nie znaleziono pacjenta');
  assert.equal(await MedicalRecord.countDocuments({ patientId: missingPatientId }), 0);
});

test('odczyt historii EHR nieistniejącego pacjenta zwraca 404 bez wpisu audytu', async () => {
  const agent = request.agent(app);
  await loginAs(agent, doctor.email);
  const missingPatientId = new mongoose.Types.ObjectId();

  const response = await agent
    .get(`/api/records/patient/${missingPatientId}`)
    .expect(404);

  assert.equal(response.body.message, 'Nie znaleziono pacjenta');
  assert.equal(await AuditLog.countDocuments({ action: 'VIEW_EHR', targetPatientId: missingPatientId }), 0);
});

test('dostępność odrzuca nieprawidłowy czas trwania zamiast generować nieskończoną siatkę terminów', async () => {
  const agent = request.agent(app);
  await loginAs(agent, receptionist.email);

  const response = await agent
    .get(`/api/appointments/availability?doctorId=${doctor._id}&date=2026-05-20&durationMinutes=-5`)
    .expect(400);

  assert.equal(response.body.message, 'Czas trwania wizyty musi wynosić od 5 do 240 minut');
});

test('aktualizacja profilu pacjenta zapisuje alergie i tworzy wpis audytu', async () => {
  const agent = request.agent(app);
  const login = await loginAs(agent, receptionist.email);

  const response = await agent
    .put(`/api/patients/${patient._id}`)
    .set('X-CSRF-Token', login.body.csrfToken)
    .send({
      allergies: [{ substance: 'Penicylina', reaction: 'Wysypka', severity: 'MEDIUM' }],
      chronicConditions: [{ name: 'Nadciśnienie tętnicze', icd10Code: 'I10' }]
    })
    .expect(200);

  assert.equal(response.body.patient.allergies[0].substance, 'Penicylina');
  assert.equal(response.body.patient.chronicConditions[0].icd10Code, 'I10');
  assert.equal(await AuditLog.countDocuments({ action: 'UPDATE_PATIENT', targetPatientId: patient._id }), 1);
});

test('pacjenta można zarchiwizować bez usuwania danych z bazy', async () => {
  const agent = request.agent(app);
  const login = await loginAs(agent, receptionist.email);

  const response = await agent
    .patch(`/api/patients/${patient._id}/archive`)
    .set('X-CSRF-Token', login.body.csrfToken)
    .send({})
    .expect(200);

  assert.equal(response.body.patient.status, 'ARCHIVED');
  assert.equal(await Patient.countDocuments({ _id: patient._id }), 1);
});

test('endpoint pacjenta zwraca historię jego wizyt', async () => {
  await Appointment.create({
    patientId: patient._id,
    doctorId: doctor._id,
    dateTime: new Date('2026-05-21T09:00:00.000Z')
  });

  const agent = request.agent(app);
  await loginAs(agent, doctor.email);

  const response = await agent
    .get(`/api/patients/${patient._id}/appointments`)
    .expect(200);

  assert.equal(response.body.appointments.length, 1);
  assert.equal(response.body.appointments[0].patientId._id, patient._id.toString());
});

async function loginAs(agent, email) {
  return agent
    .post('/api/auth/login')
    .send({ email, password: 'Demo1234!' })
    .expect(200);
}

function newPatientPayload(pesel) {
  return {
    pesel,
    firstName: 'Nowy',
    lastName: 'Pacjent',
    dateOfBirth: '1980-01-01',
    gender: 'F'
  };
}
