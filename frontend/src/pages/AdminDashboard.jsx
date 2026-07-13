import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { auditActionLabel, roleLabel } from '../utils/labels.js';

const initialUserForm = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: 'RECEPTIONIST',
  specialization: '',
  licenseNumber: '',
  patientId: '',
  isActive: true
};

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState(initialUserForm);
  const [formError, setFormError] = useState('');
  const { setToast } = useToast();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    loadUsers();
    loadLogs();
    loadPatients();
    const interval = setInterval(loadLogs, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadUsers() {
    const data = await api('/admin/users');
    setUsers(data.users);
  }

  async function loadLogs() {
    const data = await api('/admin/audit-logs?limit=20');
    setLogs(data.logs);
  }

  async function loadPatients() {
    const data = await api('/patients?limit=100&status=ALL');
    setPatients(data.items);
  }

  async function createUser(e) {
    e.preventDefault();
    const validationError = validateStaffForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError('');
    try {
      const data = await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setUsers(prev => [...prev, data.user].sort((a, b) => a.lastName.localeCompare(b.lastName)));
      setForm({ ...initialUserForm });
      setToast({ variant: 'success', title: 'Gotowe', message: 'Konto zostało utworzone' });
    } catch (err) {
      setToast({ variant: 'danger', title: 'Błąd', message: err.message });
    }
  }

  async function toggleUser(user) {
    try {
      const data = await api(`/admin/users/${user._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive })
      });
      setUsers(prev => prev.map(item => item._id === user._id ? data.user : item));
      setToast({
        variant: 'success',
        title: 'Gotowe',
        message: data.user.isActive ? 'Konto zostało aktywowane' : 'Konto zostało dezaktywowane'
      });
    } catch (err) {
      setToast({ variant: 'danger', title: 'Błąd', message: err.message });
    }
  }

  const stats = useMemo(() => users.reduce((acc, user) => {
    acc.total += 1;
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, { total: 0 }), [users]);

  return (
    <div className="row g-4">
      <div className="col-12">
        <div className="row g-3">
          <StatCard label="Użytkownicy" value={stats.total || 0} />
          <StatCard label="Lekarze" value={stats.DOCTOR || 0} />
          <StatCard label="Pacjenci" value={stats.PATIENT || 0} />
          <StatCard label="Rejestracja" value={stats.RECEPTIONIST || 0} />
        </div>
      </div>

      <div className="col-xl-4">
        <form className="card p-3" onSubmit={createUser}>
          <h2 className="h5">Utwórz użytkownika</h2>
          {formError && <div className="alert alert-warning py-2">{formError}</div>}
          <div className="row g-2">
            <div className="col-md-6"><input className="form-control" placeholder="Imię" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required /></div>
            <div className="col-md-6"><input className="form-control" placeholder="Nazwisko" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required /></div>
            <div className="col-12"><input className="form-control" type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
            <div className="col-12"><input className="form-control" type="password" placeholder="Hasło tymczasowe" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} /></div>
            <div className="col-12">
              <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="RECEPTIONIST">{roleLabel('RECEPTIONIST')}</option>
                <option value="DOCTOR">{roleLabel('DOCTOR')}</option>
                <option value="PATIENT">{roleLabel('PATIENT')}</option>
                <option value="ADMIN">{roleLabel('ADMIN')}</option>
              </select>
            </div>
            {form.role === 'DOCTOR' && (
              <div className="col-12"><input className="form-control" placeholder="Specjalizacja" value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} /></div>
            )}
            {form.role === 'DOCTOR' && (
              <div className="col-12"><input className="form-control" placeholder="Numer prawa wykonywania zawodu" value={form.licenseNumber} onChange={e => setForm({ ...form, licenseNumber: e.target.value })} required /></div>
            )}
            {form.role === 'PATIENT' && (
              <div className="col-12">
                <select className="form-select" value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })} required>
                  <option value="">Powiązana karta pacjenta</option>
                  {patients.map(patient => (
                    <option key={patient._id} value={patient._id}>{patient.lastName} {patient.firstName} - {patient.pesel}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <button className="btn btn-primary mt-3">Utwórz</button>
        </form>
      </div>

      <div className="col-xl-8">
        <div className="card p-3">
          <h2 className="h5">Personel</h2>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>Użytkownik</th><th>Rola</th><th>Email</th><th>Powiązanie</th><th>Status</th><th /></tr></thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td>{user.lastName} {user.firstName}</td>
                    <td><span className="badge text-bg-dark">{roleLabel(user.role)}</span></td>
                    <td>{user.email}</td>
                    <td>{user.patientId ? `${user.patientId.lastName} ${user.patientId.firstName}` : user.specialization || 'Brak'}</td>
                    <td>{user.isActive ? 'Aktywne' : 'Nieaktywne'}</td>
                    <td className="text-end">
                      <button
                        className={`btn btn-sm ${user.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                        onClick={() => toggleUser(user)}
                        disabled={user._id === currentUser._id}
                      >
                        {user.isActive ? 'Dezaktywuj' : 'Aktywuj'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card p-3">
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="h5 mb-0">Ostatnie zdarzenia bezpieczeństwa</h2>
            <small className="text-muted">odświeżanie co 15 s</small>
          </div>
          <div className="list-group list-group-flush mt-2">
            {logs.map(log => (
              <div key={log._id} className="list-group-item px-0 d-flex flex-column flex-md-row justify-content-between gap-1">
                <span><strong>{auditActionLabel(log.action)}</strong> · {log.userId?.email || 'system'}</span>
                <span className="text-muted">{new Date(log.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="col-sm-6 col-xl-3">
      <div className="card p-3 h-100">
        <small className="text-muted">{label}</small>
        <div className="display-6">{value}</div>
      </div>
    </div>
  );
}

function validateStaffForm(form) {
  if (!form.firstName.trim() || !form.lastName.trim()) return 'Podaj imię i nazwisko użytkownika.';
  if (!form.email.trim()) return 'Podaj email użytkownika.';
  if (form.password.length < 8) return 'Hasło tymczasowe musi mieć co najmniej 8 znaków.';
  if (form.role === 'DOCTOR' && !form.licenseNumber.trim()) {
    return 'Dla lekarza wymagany jest numer prawa wykonywania zawodu.';
  }
  if (form.role === 'PATIENT' && !form.patientId) {
    return 'Wybierz kartę pacjenta dla konta pacjenta.';
  }
  return '';
}
