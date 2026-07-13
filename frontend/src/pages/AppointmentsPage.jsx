import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { appointmentStatusBadgeClass, appointmentStatusLabel } from '../utils/labels.js';

const weekdayLabels = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];

function dateToInputValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function todayInputValue() {
  return dateToInputValue(new Date());
}

function parseLocalDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfDayIso(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

function endOfDayIso(date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy.toISOString();
}

function monthRange(monthDate) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  return { from: startOfDayIso(start), to: endOfDayIso(end) };
}

function dayRange(dateValue) {
  const date = parseLocalDate(dateValue);
  return { from: startOfDayIso(date), to: endOfDayIso(date) };
}

function monthLabel(date) {
  return date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
}

function appointmentCountLabel(count) {
  if (count === 1) return '1 wizyta';
  if (count >= 2 && count <= 4) return `${count} wizyty`;
  return `${count} wizyt`;
}

function loadClass(count) {
  if (count === 0) return 'load-empty';
  if (count <= 2) return 'load-low';
  if (count <= 5) return 'load-medium';
  return 'load-high';
}

function buildCalendarDays(monthDate) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const cells = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ key: `empty-start-${index}`, empty: true });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    cells.push({
      key: dateToInputValue(date),
      date,
      dateValue: dateToInputValue(date),
      day
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `empty-end-${cells.length}`, empty: true });
  }

  return cells;
}

export default function AppointmentsPage() {
  const [searchParams] = useSearchParams();
  const initialDate = todayInputValue();
  const [monthDate, setMonthDate] = useState(() => parseLocalDate(initialDate));
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [monthAppointments, setMonthAppointments] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [selectedAppointments, setSelectedAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorFilter, setDoctorFilter] = useState(searchParams.get('doctorId') || '');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [form, setForm] = useState({
    doctorId: '',
    appointmentDate: initialDate,
    dateTime: '',
    durationMinutes: 30,
    visitType: 'Konsultacja',
    reason: '',
    notes: ''
  });
  const { user } = useAuth();
  const { setToast } = useToast();
  const canCreateAppointments = ['ADMIN', 'RECEPTIONIST'].includes(user.role);

  useEffect(() => {
    api('/appointments/doctors')
      .then(data => setDoctors(data.doctors))
      .catch(err => setToast({ variant: 'danger', title: 'Błąd', message: err.message }));
  }, []);

  useEffect(() => {
    refreshAppointments();
  }, [monthDate, selectedDate, doctorFilter, statusFilter]);

  useEffect(() => {
    if (!form.doctorId || !form.appointmentDate || !canCreateAppointments) {
      setAvailability([]);
      return;
    }
    loadAvailability();
  }, [form.doctorId, form.durationMinutes, form.appointmentDate, canCreateAppointments]);

  function buildAppointmentParams(range) {
    const params = new URLSearchParams(range);
    if (doctorFilter) params.set('doctorId', doctorFilter);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    return params;
  }

  async function refreshAppointments() {
    try {
      const today = todayInputValue();
      const [monthData, todayData, selectedData] = await Promise.all([
        api(`/appointments?${buildAppointmentParams(monthRange(monthDate)).toString()}`),
        api(`/appointments?${buildAppointmentParams(dayRange(today)).toString()}`),
        api(`/appointments?${buildAppointmentParams(dayRange(selectedDate)).toString()}`)
      ]);
      setMonthAppointments(monthData.items);
      setTodayAppointments(todayData.items);
      setSelectedAppointments(selectedData.items);
    } catch (err) {
      setToast({ variant: 'danger', title: 'Błąd', message: err.message });
    }
  }

  async function loadAvailability() {
    try {
      const params = new URLSearchParams({
        doctorId: form.doctorId,
        date: form.appointmentDate,
        durationMinutes: String(form.durationMinutes)
      });
      const data = await api(`/appointments/availability?${params.toString()}`);
      setAvailability(data.slots);
    } catch (err) {
      setAvailability([]);
      setToast({ variant: 'danger', title: 'Błąd', message: err.message });
    }
  }

  function selectDate(dateValue) {
    setSelectedDate(dateValue);
    setMonthDate(parseLocalDate(dateValue));
    setForm(prev => ({ ...prev, appointmentDate: dateValue, dateTime: '' }));
  }

  function changeMonth(offset) {
    const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + offset, 1);
    const nextDate = dateToInputValue(nextMonth);
    setMonthDate(nextMonth);
    setSelectedDate(nextDate);
    setForm(prev => ({ ...prev, appointmentDate: nextDate, dateTime: '' }));
  }

  async function searchPatients(value) {
    setPatientSearch(value);
    setSelectedPatient(null);
    if (value.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    try {
      const data = await api(`/patients?search=${encodeURIComponent(value)}&limit=8&status=ACTIVE`);
      setPatientResults(data.items);
    } catch {
      setPatientResults([]);
    }
  }

  async function createAppointment(e) {
    e.preventDefault();
    if (!selectedPatient) {
      setToast({ variant: 'warning', title: 'Pacjent', message: 'Najpierw wybierz pacjenta' });
      return;
    }
    if (!form.doctorId || !form.dateTime) {
      setToast({ variant: 'warning', title: 'Termin', message: 'Wybierz lekarza i wolny termin wizyty' });
      return;
    }

    try {
      await api('/appointments', {
        method: 'POST',
        body: JSON.stringify({ ...form, patientId: selectedPatient._id })
      });
      setForm(prev => ({
        ...prev,
        dateTime: '',
        reason: '',
        notes: ''
      }));
      setSelectedPatient(null);
      setPatientSearch('');
      setPatientResults([]);
      await Promise.all([refreshAppointments(), loadAvailability()]);
      setToast({ variant: 'success', title: 'Gotowe', message: 'Wizyta została utworzona' });
    } catch (err) {
      setToast({ variant: 'danger', title: 'Błąd', message: err.message });
    }
  }

  async function updateStatus(id, status) {
    try {
      await api(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      await refreshAppointments();
      setToast({ variant: 'success', title: 'Gotowe', message: 'Status wizyty został zaktualizowany' });
    } catch (err) {
      setToast({ variant: 'danger', title: 'Błąd', message: err.message });
    }
  }

  const doctorOptions = useMemo(() => doctors.map(doctor => ({
    ...doctor,
    label: `${doctor.lastName} ${doctor.firstName}${doctor.specialization ? `, ${doctor.specialization}` : ''}`
  })), [doctors]);

  const appointmentsByDate = useMemo(() => monthAppointments.reduce((acc, item) => {
    const key = dateToInputValue(new Date(item.dateTime));
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [monthAppointments]);

  const nextAppointmentDate = useMemo(() => {
    const selected = parseLocalDate(selectedDate);
    const next = monthAppointments.find(item => new Date(item.dateTime) > selected);
    return next ? dateToInputValue(new Date(next.dateTime)) : '';
  }, [monthAppointments, selectedDate]);

  const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);
  const availableSlots = availability.filter(slot => slot.available);

  return (
    <div className="d-grid gap-4">
      <section className="card p-3 p-lg-4">
        <div className="d-flex flex-column gap-3">
          <div>
            <h2 className="h4 mb-1">Wizyty</h2>
            <p className="text-muted mb-0">Harmonogram, rezerwacja terminów i obsługa statusów wizyt</p>
          </div>
          <div className="row g-2 align-items-end">
            <div className="col-md-4 col-xl-3">
              <label className="form-label" htmlFor="appointment-date-filter">Data</label>
              <input id="appointment-date-filter" className="form-control" type="date" value={selectedDate} onChange={e => selectDate(e.target.value)} />
            </div>
            {user.role !== 'DOCTOR' && (
              <div className="col-md-4 col-xl-3">
                <label className="form-label" htmlFor="appointment-doctor-filter">Lekarz</label>
                <select id="appointment-doctor-filter" className="form-select" value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)}>
                  <option value="">Wszyscy lekarze</option>
                  {doctorOptions.map(doctor => <option key={doctor._id} value={doctor._id}>{doctor.label}</option>)}
                </select>
              </div>
            )}
            <div className="col-md-4 col-xl-3">
              <label className="form-label" htmlFor="appointment-status-filter">Status</label>
              <select id="appointment-status-filter" className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="ALL">Wszystkie statusy</option>
                <option value="SCHEDULED">Zaplanowana</option>
                <option value="COMPLETED">Zakończona</option>
                <option value="CANCELLED">Anulowana</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="card p-3">
        <div className="d-flex flex-column flex-md-row gap-2 justify-content-between align-items-md-center mb-3">
          <h3 className="h5 mb-0">Kalendarz miesiąca</h3>
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-sm btn-outline-primary" onClick={() => changeMonth(-1)}>Poprzedni miesiąc</button>
            <strong className="text-capitalize calendar-month-label">{monthLabel(monthDate)}</strong>
            <button className="btn btn-sm btn-outline-primary" onClick={() => changeMonth(1)}>Następny miesiąc</button>
          </div>
        </div>

        <div className="calendar-scroll">
          <div className="calendar-grid calendar-weekdays mb-2">
            {weekdayLabels.map(label => <div key={label} className="calendar-weekday">{label}</div>)}
          </div>
          <div className="calendar-grid">
            {calendarDays.map(day => {
              if (day.empty) return <div key={day.key} className="calendar-day calendar-day-empty" />;
              const count = appointmentsByDate[day.dateValue] || 0;
              const isToday = day.dateValue === todayInputValue();
              const isSelected = day.dateValue === selectedDate;
              return (
                <button
                  key={day.key}
                  type="button"
                  className={`calendar-day ${loadClass(count)} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => selectDate(day.dateValue)}
                >
                  <span className="calendar-day-number">{day.day}</span>
                  <span className="calendar-day-count">{count ? appointmentCountLabel(count) : 'Brak wizyt'}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="d-flex flex-wrap gap-3 mt-3 small">
          <LegendItem className="load-empty" label="Brak wizyt" />
          <LegendItem className="load-low" label="Małe obciążenie" />
          <LegendItem className="load-medium" label="Średnie obciążenie" />
          <LegendItem className="load-high" label="Duże obciążenie" />
        </div>
        {monthAppointments.length === 0 && (
          <div className="text-muted mt-3">Brak wizyt w wybranym miesiącu.</div>
        )}
      </section>

      <section className="card p-3">
        <h3 className="h5">Dzisiejsze wizyty</h3>
        <AppointmentTable
          appointments={todayAppointments}
          user={user}
          emptyText="Brak wizyt zaplanowanych na dzisiaj."
          onUpdateStatus={updateStatus}
        />
      </section>

      {canCreateAppointments && (
        <section className="card p-3">
          <h3 className="h5">Nowa wizyta</h3>
          <form className="row g-3" onSubmit={createAppointment}>
            <div className="col-lg-4 position-relative">
              <label className="form-label" htmlFor="appointment-patient">Pacjent</label>
              <input
                id="appointment-patient"
                className="form-control"
                placeholder="PESEL, imię lub nazwisko"
                value={patientSearch}
                onChange={e => searchPatients(e.target.value)}
              />
              {patientSearch.trim().length >= 2 && patientResults.length === 0 && !selectedPatient && (
                <div className="form-text">Brak pacjentów dla podanej frazy.</div>
              )}
              {patientResults.length > 0 && (
                <div className="list-group position-absolute w-100 mt-1 shadow search-results">
                  {patientResults.map(patient => (
                    <button
                      key={patient._id}
                      type="button"
                      className="list-group-item list-group-item-action"
                      onClick={() => {
                        setSelectedPatient(patient);
                        setPatientSearch(`${patient.pesel} - ${patient.lastName} ${patient.firstName}`);
                        setPatientResults([]);
                      }}
                    >
                      <strong>{patient.lastName} {patient.firstName}</strong>
                      <div className="small text-muted">{patient.pesel}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-lg-4">
              <label className="form-label" htmlFor="appointment-doctor">Lekarz</label>
              <select id="appointment-doctor" className="form-select" value={form.doctorId} onChange={e => setForm({ ...form, doctorId: e.target.value, dateTime: '' })}>
                <option value="">Wybierz lekarza</option>
                {doctorOptions.map(doctor => <option key={doctor._id} value={doctor._id}>{doctor.label}</option>)}
              </select>
              {doctorOptions.length === 0 && <div className="form-text">Brak dostępnych lekarzy.</div>}
            </div>
            <div className="col-lg-4">
              <label className="form-label" htmlFor="appointment-form-date">Data wizyty</label>
              <input id="appointment-form-date" className="form-control" type="date" value={form.appointmentDate} onChange={e => selectDate(e.target.value)} />
            </div>
            <div className="col-lg-4">
              <label className="form-label" htmlFor="appointment-duration">Czas trwania</label>
              <select id="appointment-duration" className="form-select" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value), dateTime: '' })}>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
            <div className="col-lg-4">
              <label className="form-label" htmlFor="appointment-type">Typ wizyty</label>
              <select id="appointment-type" className="form-select" value={form.visitType} onChange={e => setForm({ ...form, visitType: e.target.value })}>
                <option value="Konsultacja">Konsultacja</option>
                <option value="Kontrola">Kontrola</option>
                <option value="Badanie">Badanie</option>
                <option value="Wizyta pierwszorazowa">Wizyta pierwszorazowa</option>
              </select>
            </div>
            <div className="col-lg-4">
              <label className="form-label" htmlFor="appointment-reason">Powód wizyty</label>
              <input id="appointment-reason" className="form-control" placeholder="np. kontrola ciśnienia" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div className="col-12">
              <div className="small text-muted mb-2">Wolne terminy</div>
              <div className="d-flex flex-wrap gap-2 availability-grid">
                {!form.doctorId && <span className="text-muted small">Wybierz lekarza, aby zobaczyć terminy.</span>}
                {form.doctorId && availability.length === 0 && <span className="text-muted small">Ładowanie terminów lub brak danych dla wybranego dnia.</span>}
                {form.doctorId && availability.length > 0 && availableSlots.length === 0 && (
                  <span className="text-muted small">Brak wolnych terminów dla wybranego lekarza w tym dniu.</span>
                )}
                {availableSlots.map(slot => (
                  <button
                    key={slot.start}
                    type="button"
                    className={`btn btn-sm ${form.dateTime === slot.start ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setForm({ ...form, dateTime: slot.start })}
                  >
                    {new Date(slot.start).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="appointment-notes">Notatki</label>
              <textarea id="appointment-notes" className="form-control" rows="2" placeholder="Dodatkowe informacje do wizyty" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="col-12">
              <button className="btn btn-primary">Utwórz wizytę</button>
            </div>
          </form>
        </section>
      )}

      <section className="card p-3">
        <div className="d-flex flex-column flex-md-row gap-1 justify-content-between align-items-md-center mb-2">
          <h3 className="h5 mb-0">Harmonogram wybranego dnia</h3>
          <span className="text-muted">Harmonogram: {parseLocalDate(selectedDate).toLocaleDateString('pl-PL')}</span>
        </div>
        <AppointmentTable
          appointments={selectedAppointments}
          user={user}
          emptyText="Brak wizyt w wybranym dniu. Sprawdź inne dni w kalendarzu."
          onUpdateStatus={updateStatus}
        />
        {selectedAppointments.length === 0 && nextAppointmentDate && (
          <div className="text-muted small mt-2">
            Najbliższe wizyty znajdują się dnia: {parseLocalDate(nextAppointmentDate).toLocaleDateString('pl-PL')}.
          </div>
        )}
      </section>
    </div>
  );
}

function LegendItem({ className, label }) {
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <span className={`calendar-legend-dot ${className}`} />
      {label}
    </span>
  );
}

function AppointmentTable({ appointments, user, emptyText, onUpdateStatus }) {
  return (
    <div className="table-responsive">
      <table className="table align-middle mb-0">
        <thead><tr><th>Godzina</th><th>Pacjent</th><th>Lekarz</th><th>Typ</th><th>Powód</th><th>Status</th><th /></tr></thead>
        <tbody>
          {appointments.length === 0 && (
            <tr><td colSpan="7" className="text-muted">{emptyText}</td></tr>
          )}
          {appointments.map(item => (
            <tr key={item._id}>
              <td>{new Date(item.dateTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</td>
              <td>{item.patientId ? <Link to={`/patients/${item.patientId._id}`}>{item.patientId.lastName} {item.patientId.firstName}</Link> : 'Brak pacjenta'}</td>
              <td>{item.doctorId?.lastName} {item.doctorId?.firstName}</td>
              <td>{item.visitType || 'Konsultacja'}</td>
              <td>{item.reason || item.notes || 'Brak'}</td>
              <td><span className={`badge ${appointmentStatusBadgeClass(item.status)}`}>{appointmentStatusLabel(item.status)}</span></td>
              <td className="text-end">
                <div className="btn-group btn-group-sm">
                  {item.patientId && <Link className="btn btn-outline-primary" to={`/patients/${item.patientId._id}`}>Karta</Link>}
                  {item.status === 'SCHEDULED' && ['ADMIN', 'RECEPTIONIST'].includes(user.role) && (
                    <button className="btn btn-outline-danger" onClick={() => onUpdateStatus(item._id, 'CANCELLED')}>Anuluj</button>
                  )}
                  {item.status === 'SCHEDULED' && ['ADMIN', 'DOCTOR'].includes(user.role) && (
                    <button className="btn btn-outline-success" onClick={() => onUpdateStatus(item._id, 'COMPLETED')}>Zakończ</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
