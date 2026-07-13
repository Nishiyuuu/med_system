import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { appointmentStatusLabel } from '../utils/labels.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardPage() {
  const [patients, setPatients] = useState({ items: [], total: 0 });
  const [doctors, setDoctors] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const { setToast } = useToast();
  const { user } = useAuth();
  const isPatient = user.role === 'PATIENT';

  useEffect(() => {
    async function loadDashboard() {
      try {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);

        const [patientsData, doctorsData, todayData, upcomingData] = await Promise.all([
          api('/patients?limit=5&status=ACTIVE'),
          api('/appointments/doctors'),
          api(`/appointments?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`),
          api(`/appointments?startDate=${new Date().toISOString()}&status=SCHEDULED`)
        ]);

        setPatients(patientsData);
        setDoctors(doctorsData.doctors);
        setTodayAppointments(todayData.items);
        setUpcomingAppointments(upcomingData.items.slice(0, 5));
      } catch (err) {
        setToast({ variant: 'danger', title: 'Błąd', message: err.message });
      }
    }

    loadDashboard();
  }, []);

  const completedToday = useMemo(
    () => todayAppointments.filter(item => item.status === 'COMPLETED').length,
    [todayAppointments]
  );
  const patientCard = patients.items[0] || null;

  return (
    <div className="d-grid gap-4">
      <section>
        <h2 className="h4 mb-1">Panel główny</h2>
        <p className="text-muted mb-0">
          {isPatient ? 'Podgląd Twoich wizyt i podstawowych danych medycznych' : 'Szybki przegląd pracy centrum medycznego'}
        </p>
      </section>

      <section className="row g-3">
        <StatCard label={isPatient ? 'Moja karta' : 'Aktywni pacjenci'} value={isPatient ? (patientCard ? 'OK' : 'Brak') : patients.total || 0} />
        <StatCard label="Lekarze" value={doctors.length} />
        <StatCard label="Wizyty dzisiaj" value={todayAppointments.length} />
        <StatCard label="Zakończone dzisiaj" value={completedToday} />
      </section>

      <section className="row g-4">
        {isPatient ? (
          <div className="col-xl-6">
            <div className="card p-3 h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h3 className="h5 mb-0">Moja karta pacjenta</h3>
                {patientCard && <Link className="btn btn-sm btn-outline-primary" to={`/patients/${patientCard._id}`}>Otwórz</Link>}
              </div>
              {patientCard ? (
                <div>
                  <div><strong>{patientCard.lastName} {patientCard.firstName}</strong></div>
                  <div className="text-muted">PESEL: {patientCard.pesel}</div>
                  <div className="text-muted">{patientCard.contact?.email || patientCard.contact?.phone || 'Brak danych kontaktowych'}</div>
                </div>
              ) : (
                <div className="text-muted py-2">Brak powiązanej karty pacjenta.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="col-xl-6">
            <div className="card p-3 h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h3 className="h5 mb-0">Ostatnio dodani pacjenci</h3>
                <Link className="btn btn-sm btn-outline-primary" to="/patients">Pacjenci</Link>
              </div>
              <div className="list-group list-group-flush">
                {patients.items.length === 0 && <div className="text-muted py-2">Brak pacjentów do wyświetlenia.</div>}
                {patients.items.map(patient => (
                  <Link key={patient._id} className="list-group-item list-group-item-action px-0" to={`/patients/${patient._id}`}>
                    <div className="d-flex justify-content-between gap-2">
                      <span><strong>{patient.lastName} {patient.firstName}</strong></span>
                      <span className="text-muted">{patient.pesel}</span>
                    </div>
                    <small className="text-muted">{patient.contact?.phone || patient.contact?.email || 'Brak kontaktu'}</small>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="col-xl-6">
          <div className="card p-3 h-100">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h3 className="h5 mb-0">{isPatient ? 'Moje najbliższe wizyty' : 'Najbliższe wizyty'}</h3>
              <Link className="btn btn-sm btn-outline-primary" to="/appointments">Wizyty</Link>
            </div>
            <div className="list-group list-group-flush">
              {upcomingAppointments.length === 0 && <div className="text-muted py-2">Brak zaplanowanych wizyt.</div>}
              {upcomingAppointments.map(item => (
                <div key={item._id} className="list-group-item px-0">
                  <div className="d-flex justify-content-between gap-2">
                    <span>
                      <strong>{item.patientId?.lastName} {item.patientId?.firstName}</strong>
                      <span className="text-muted"> u {item.doctorId?.lastName} {item.doctorId?.firstName}</span>
                    </span>
                    <span className="badge text-bg-secondary">{appointmentStatusLabel(item.status)}</span>
                  </div>
                  <small className="text-muted">{new Date(item.dateTime).toLocaleString('pl-PL')}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
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
