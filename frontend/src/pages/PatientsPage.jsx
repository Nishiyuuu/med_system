import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const emptyPatientForm = {
  pesel: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  primaryDoctorId: '',
  contact: { phone: '', email: '', address: '' },
  emergencyContact: { name: '', phone: '' }
};

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState(emptyPatientForm);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const { user } = useAuth();
  const { setToast } = useToast();
  const navigate = useNavigate();
  const canManagePatients = ['ADMIN', 'RECEPTIONIST'].includes(user.role);

  useEffect(() => {
    loadPatients();
  }, [search, status]);

  useEffect(() => {
    api('/appointments/doctors')
      .then(data => setDoctors(data.doctors))
      .catch(err => setToast({ variant: 'danger', title: 'Błąd', message: err.message }));
  }, []);

  async function loadPatients() {
    try {
      const params = new URLSearchParams({ limit: '50', status });
      if (search.trim()) params.set('search', search.trim());
      const data = await api(`/patients?${params.toString()}`);
      setPatients(data.items);
      setTotal(data.total);
    } catch (err) {
      setToast({ variant: 'danger', title: 'Błąd', message: err.message });
    }
  }

  async function createPatient(e) {
    e.preventDefault();
    const validationError = validatePatient(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      const data = await api('/patients', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setForm(emptyPatientForm);
      setFormError('');
      setFormOpen(false);
      setToast({ variant: 'success', title: 'Gotowe', message: 'Pacjent został dodany' });
      navigate(`/patients/${data.patient._id}`);
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function archivePatient(patient) {
    try {
      await api(`/patients/${patient._id}/archive`, { method: 'PATCH', body: JSON.stringify({}) });
      setToast({ variant: 'success', title: 'Gotowe', message: 'Pacjent został zarchiwizowany' });
      loadPatients();
    } catch (err) {
      setToast({ variant: 'danger', title: 'Błąd', message: err.message });
    }
  }

  const doctorOptions = useMemo(() => doctors.map(doctor => ({
    value: doctor._id,
    label: `${doctor.lastName} ${doctor.firstName}${doctor.specialization ? `, ${doctor.specialization}` : ''}`
  })), [doctors]);

  return (
    <div className="d-grid gap-4">
      <section className="card p-3 p-lg-4">
        <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-lg-center">
          <div>
            <h2 className="h4 mb-1">Pacjenci</h2>
            <p className="text-muted mb-0">Lista pacjentów, wyszukiwanie i obsługa danych rejestracyjnych</p>
          </div>
          {canManagePatients && (
            <button className="btn btn-primary" onClick={() => setFormOpen(true)}>Dodaj pacjenta</button>
          )}
        </div>
      </section>

      <section className="card p-3">
        <div className="row g-2 align-items-end">
          <div className="col-md-8">
            <label className="form-label" htmlFor="patient-search">Szukaj pacjenta</label>
            <input
              id="patient-search"
              className="form-control"
              placeholder="Imię, nazwisko lub PESEL"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="patient-status">Status</label>
            <select id="patient-status" className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="ACTIVE">Aktywni</option>
              <option value="ARCHIVED">Archiwalni</option>
              <option value="ALL">Wszyscy</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card p-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h3 className="h5 mb-0">Lista pacjentów</h3>
          <small className="text-muted">Wyniki: {total}</small>
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Imię</th>
                <th>Nazwisko</th>
                <th>PESEL</th>
                <th>Data urodzenia</th>
                <th>Telefon</th>
                <th>E-mail</th>
                <th>Status</th>
                <th>Lekarz prowadzący</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {patients.length === 0 && (
                <tr><td colSpan="9" className="text-muted">Brak pacjentów dla wybranych filtrów.</td></tr>
              )}
              {patients.map(patient => (
                <tr key={patient._id}>
                  <td>{patient.firstName}</td>
                  <td>{patient.lastName}</td>
                  <td>{patient.pesel}</td>
                  <td>{new Date(patient.dateOfBirth).toLocaleDateString('pl-PL')}</td>
                  <td>{patient.contact?.phone || 'Brak'}</td>
                  <td>{patient.contact?.email || 'Brak'}</td>
                  <td><span className={`badge text-bg-${patient.status === 'ARCHIVED' ? 'secondary' : 'success'}`}>{patient.status === 'ARCHIVED' ? 'Archiwalny' : 'Aktywny'}</span></td>
                  <td>{patient.primaryDoctorId ? `${patient.primaryDoctorId.lastName} ${patient.primaryDoctorId.firstName}` : 'Nie przypisano'}</td>
                  <td className="text-end">
                    <div className="btn-group btn-group-sm">
                      <Link className="btn btn-outline-primary" to={`/patients/${patient._id}`}>Szczegóły</Link>
                      {canManagePatients && patient.status !== 'ARCHIVED' && (
                        <button className="btn btn-outline-danger" onClick={() => archivePatient(patient)}>Archiwizuj</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && (
        <div className="modal d-block bg-dark bg-opacity-50">
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <form className="modal-content" onSubmit={createPatient}>
              <div className="modal-header">
                <h2 className="modal-title fs-5">Dodaj pacjenta</h2>
                <button type="button" className="btn-close" onClick={() => setFormOpen(false)} />
              </div>
              <div className="modal-body row g-3">
                {formError && <div className="col-12"><div className="alert alert-warning py-2 mb-0">{formError}</div></div>}
                <PatientForm form={form} setForm={setForm} doctors={doctorOptions} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setFormOpen(false)}>Anuluj</button>
                <button className="btn btn-primary">Zapisz pacjenta</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PatientForm({ form, setForm, doctors }) {
  return (
    <>
      <div className="col-md-4"><input className="form-control" placeholder="PESEL" value={form.pesel} onChange={e => setForm({ ...form, pesel: e.target.value })} required maxLength={11} /></div>
      <div className="col-md-4"><input className="form-control" placeholder="Imię" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required /></div>
      <div className="col-md-4"><input className="form-control" placeholder="Nazwisko" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required /></div>
      <div className="col-md-4"><input className="form-control" type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} required /></div>
      <div className="col-md-4">
        <select className="form-select" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} required>
          <option value="">Płeć</option>
          <option value="F">Kobieta</option>
          <option value="M">Mężczyzna</option>
          <option value="Inna">Inna</option>
        </select>
      </div>
      <div className="col-md-4">
        <select className="form-select" value={form.primaryDoctorId} onChange={e => setForm({ ...form, primaryDoctorId: e.target.value })}>
          <option value="">Lekarz prowadzący</option>
          {doctors.map(doctor => <option key={doctor.value} value={doctor.value}>{doctor.label}</option>)}
        </select>
      </div>
      <div className="col-md-6"><input className="form-control" placeholder="Telefon" value={form.contact.phone} onChange={e => setForm({ ...form, contact: { ...form.contact, phone: e.target.value } })} /></div>
      <div className="col-md-6"><input className="form-control" type="email" placeholder="E-mail" value={form.contact.email} onChange={e => setForm({ ...form, contact: { ...form.contact, email: e.target.value } })} /></div>
      <div className="col-12"><input className="form-control" placeholder="Adres" value={form.contact.address} onChange={e => setForm({ ...form, contact: { ...form.contact, address: e.target.value } })} /></div>
      <div className="col-md-6"><input className="form-control" placeholder="Osoba kontaktowa" value={form.emergencyContact.name} onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, name: e.target.value } })} /></div>
      <div className="col-md-6"><input className="form-control" placeholder="Telefon osoby kontaktowej" value={form.emergencyContact.phone} onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, phone: e.target.value } })} /></div>
    </>
  );
}

function validatePatient(form) {
  if (!/^\d{11}$/.test(form.pesel.trim())) return 'PESEL musi mieć dokładnie 11 cyfr.';
  if (!form.firstName.trim() || !form.lastName.trim()) return 'Podaj imię i nazwisko pacjenta.';
  if (!form.dateOfBirth) return 'Podaj datę urodzenia pacjenta.';
  if (!form.gender) return 'Wybierz płeć pacjenta.';
  if (form.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact.email)) return 'Podaj poprawny e-mail pacjenta.';
  return '';
}
