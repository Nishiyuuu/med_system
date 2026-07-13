import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const { setToast } = useToast();

  useEffect(() => {
    async function loadDoctors() {
      try {
        const [doctorData, appointmentData] = await Promise.all([
          api('/appointments/doctors'),
          api(`/appointments?startDate=${new Date().toISOString()}&status=SCHEDULED`)
        ]);
        setDoctors(doctorData.doctors);
        setAppointments(appointmentData.items);
      } catch (err) {
        setToast({ variant: 'danger', title: 'Błąd', message: err.message });
      }
    }

    loadDoctors();
  }, []);

  const filteredDoctors = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return doctors;
    return doctors.filter(doctor => `${doctor.firstName} ${doctor.lastName} ${doctor.specialization || ''}`.toLowerCase().includes(value));
  }, [doctors, search]);

  function appointmentsCount(doctorId) {
    return appointments.filter(item => item.doctorId?._id === doctorId).length;
  }

  return (
    <div className="d-grid gap-4">
      <section className="card p-3 p-lg-4">
        <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-lg-center">
          <div>
            <h2 className="h4 mb-1">Lekarze</h2>
            <p className="text-muted mb-0">Lista lekarzy, specjalizacje i najbliższe obciążenie terminarza</p>
          </div>
          {user.role === 'ADMIN' && <Link className="btn btn-outline-primary" to="/admin">Zarządzaj kontami</Link>}
        </div>
      </section>

      <section className="card p-3">
        <label className="form-label" htmlFor="doctor-search">Szukaj lekarza</label>
        <input
          id="doctor-search"
          className="form-control"
          placeholder="Imię, nazwisko lub specjalizacja"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </section>

      <section className="card p-3">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>Lekarz</th><th>Specjalizacja</th><th>Gabinet</th><th>Godziny pracy</th><th>Telefon</th><th>Zaplanowane wizyty</th><th /></tr></thead>
            <tbody>
              {filteredDoctors.length === 0 && <tr><td colSpan="7" className="text-muted">Brak lekarzy dla podanych kryteriów.</td></tr>}
              {filteredDoctors.map(doctor => (
                <tr key={doctor._id}>
                  <td>{doctor.lastName} {doctor.firstName}</td>
                  <td>{doctor.specialization || 'Nie podano'}</td>
                  <td>{doctor.office || 'Brak'}</td>
                  <td>{doctor.workingHours || 'Brak'}</td>
                  <td>{doctor.phone || 'Brak'}</td>
                  <td>{appointmentsCount(doctor._id)}</td>
                  <td className="text-end">
                    <Link className="btn btn-sm btn-outline-primary" to={`/appointments?doctorId=${doctor._id}`}>Terminarz</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
