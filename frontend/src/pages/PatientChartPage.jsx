import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api.js';
import VisitEncounterModal from '../components/VisitEncounterModal.jsx';
import EditPatientModal from '../components/EditPatientModal.jsx';
import EditRecordModal from '../components/EditRecordModal.jsx';
import DynamicResultsView from '../components/DynamicResultsView.jsx';
import PrintSummaryButton from '../components/PrintSummaryButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { appointmentStatusLabel } from '../utils/labels.js';

export default function PatientChartPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canReadClinicalHistory = ['DOCTOR', 'PATIENT'].includes(user.role);
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [tab, setTab] = useState(canReadClinicalHistory ? 'timeline' : 'appointments');
  const [expandedRecordId, setExpandedRecordId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadChart() {
      setLoading(true);
      setError('');
      try {
        const [patientData, recordData, appointmentData] = await Promise.all([
          api(`/patients/${id}`),
          canReadClinicalHistory ? api(`/records/patient/${id}`) : Promise.resolve({ records: [] }),
          api(`/patients/${id}/appointments`)
        ]);
        if (!active) return;
        setPatient(patientData.patient);
        setRecords(recordData.records);
        setAppointments(appointmentData.appointments);
        setExpandedRecordId(recordData.records[0]?._id || null);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadChart();
    return () => {
      active = false;
    };
  }, [id, user.role]);

  useEffect(() => {
    if (!canReadClinicalHistory && ['timeline', 'labs', 'meds'].includes(tab)) {
      setTab('appointments');
    }
  }, [canReadClinicalHistory, tab]);

  const prescriptions = useMemo(() => records.flatMap(record => (record.prescriptions || []).map(item => ({
    ...item,
    recordId: record._id,
    visitDate: record.visitDate
  }))), [records]);

  function updateRecord(updatedRecord) {
    setRecords(prev => prev.map(record => record._id === updatedRecord._id ? updatedRecord : record));
  }

  function addRecord(record) {
    setRecords(prev => [record, ...prev]);
    setExpandedRecordId(record._id);
  }

  function canEditRecord(record) {
    const doctorId = typeof record.doctorId === 'object' ? record.doctorId?._id : record.doctorId;
    const ageMs = Date.now() - new Date(record.createdAt).getTime();
    return user.role === 'DOCTOR' && doctorId === user._id && ageMs <= 24 * 60 * 60 * 1000;
  }

  if (loading) return <div>Ładowanie...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!patient) return <div className="alert alert-warning">Nie znaleziono pacjenta.</div>;

  return (
    <div className="row g-4">
      <div className="col-lg-4">
        <div className="card patient-sidecard p-3">
          <h2 className="h4">{patient.lastName} {patient.firstName}</h2>
          <div><strong>PESEL:</strong> {patient.pesel}</div>
          <div><strong>Status:</strong> {patient.status === 'ARCHIVED' ? 'Archiwalny' : 'Aktywny'}</div>
          <div><strong>Lekarz prowadzący:</strong> {patient.primaryDoctorId ? `${patient.primaryDoctorId.lastName} ${patient.primaryDoctorId.firstName}` : 'Nie przypisano'}</div>
          <div><strong>Data urodzenia:</strong> {new Date(patient.dateOfBirth).toLocaleDateString()}</div>
          <div><strong>Grupa krwi:</strong> {patient.bloodType || 'Brak danych'}</div>
          <div><strong>Telefon:</strong> {patient.contact?.phone || '—'}</div>
          <div><strong>Email:</strong> {patient.contact?.email || '—'}</div>
          <div className="mt-3">
            <strong>Alergie:</strong>
            <div className="d-flex flex-wrap gap-2 mt-2">
              {patient.allergies?.length
                ? patient.allergies.map((allergy, index) => (
                  <span key={`${allergy.substance}-${index}`} className={`badge text-bg-${allergy.severity === 'HIGH' ? 'danger' : allergy.severity === 'MEDIUM' ? 'warning' : 'secondary'}`}>
                    {allergy.substance}{allergy.reaction ? ` · ${allergy.reaction}` : ''}
                  </span>
                ))
                : <span className="text-muted">Brak</span>}
            </div>
          </div>
          <div className="mt-3">
            <strong>Choroby przewlekłe:</strong>
            <div className="d-flex flex-wrap gap-2 mt-2">
              {patient.chronicConditions?.length
                ? patient.chronicConditions.map((condition, index) => (
                  <span key={`${condition.name}-${index}`} className="badge text-bg-light border">
                    {condition.name}{condition.icd10Code ? ` · ${condition.icd10Code}` : ''}
                  </span>
                ))
                : <span className="text-muted">Brak</span>}
            </div>
          </div>
          <div className="mt-3">
            <strong>Przyjmowane leki:</strong>
            <div className="d-flex flex-wrap gap-2 mt-2">
              {patient.medications?.length
                ? patient.medications.map((medication, index) => <span key={`${medication}-${index}`} className="badge text-bg-light border">{medication}</span>)
                : <span className="text-muted">Brak</span>}
            </div>
          </div>
          {patient.medicalNote && <div className="alert alert-light border mt-3 mb-0">{patient.medicalNote}</div>}
          <div className="d-flex flex-wrap gap-2 mt-3">
            {user.role === 'DOCTOR' && <VisitEncounterModal patientId={id} onCreated={addRecord} />}
            {['ADMIN', 'RECEPTIONIST'].includes(user.role) && <EditPatientModal patient={patient} onUpdated={setPatient} />}
            {['DOCTOR', 'PATIENT'].includes(user.role) && <PrintSummaryButton patientId={id} />}
          </div>
        </div>
      </div>
      <div className="col-lg-8">
        <ul className="nav nav-tabs mb-3">
          {canReadClinicalHistory && <li className="nav-item"><button className={`nav-link ${tab === 'timeline' ? 'active' : ''}`} onClick={() => setTab('timeline')}>Chronologia</button></li>}
          <li className="nav-item"><button className={`nav-link ${tab === 'appointments' ? 'active' : ''}`} onClick={() => setTab('appointments')}>Wizyty</button></li>
          {canReadClinicalHistory && <li className="nav-item"><button className={`nav-link ${tab === 'labs' ? 'active' : ''}`} onClick={() => setTab('labs')}>Wyniki</button></li>}
          {canReadClinicalHistory && <li className="nav-item"><button className={`nav-link ${tab === 'meds' ? 'active' : ''}`} onClick={() => setTab('meds')}>Leki</button></li>}
        </ul>

        {!canReadClinicalHistory && (
          <div className="alert alert-info">Historia kliniczna jest dostępna tylko dla lekarza prowadzącego i pacjenta.</div>
        )}

        {tab === 'timeline' && canReadClinicalHistory && (
          <div>
            {records.length === 0 && <div className="card p-3 text-muted">Brak wpisów.</div>}
            {records.map(record => {
              const expanded = expandedRecordId === record._id;
              return (
                <div key={record._id} className="card timeline-item">
                  <button className="btn text-start p-3 d-flex justify-content-between align-items-center" onClick={() => setExpandedRecordId(expanded ? null : record._id)}>
                    <span>
                      <strong>{new Date(record.visitDate).toLocaleDateString()}</strong>
                      <span className="text-muted"> · {record.diagnosis?.description}</span>
                    </span>
                    <span>{expanded ? '−' : '+'}</span>
                  </button>
                  {expanded && (
                    <div className="border-top p-3">
                      <p><strong>Wywiad:</strong> {record.interviewNotes || '—'}</p>
                      <p><strong>Badanie:</strong> {record.physicalExamination || '—'}</p>
                      <div className="d-flex flex-column flex-md-row justify-content-between gap-2 align-items-md-end">
                        <p className="mb-0"><strong>Zalecenia:</strong> {record.recommendations || '—'}</p>
                        {canEditRecord(record) && <EditRecordModal record={record} onUpdated={updateRecord} />}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'appointments' && (
          <div className="card p-3">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead><tr><th>Data</th><th>Lekarz</th><th>Status</th><th>Notatka</th></tr></thead>
                <tbody>
                  {appointments.length === 0 && <tr><td colSpan="4" className="text-muted">Brak wizyt pacjenta.</td></tr>}
                  {appointments.map(item => (
                    <tr key={item._id}>
                      <td>{new Date(item.dateTime).toLocaleString('pl-PL')}</td>
                      <td>{item.doctorId?.lastName} {item.doctorId?.firstName}</td>
                      <td><span className="badge text-bg-secondary">{appointmentStatusLabel(item.status)}</span></td>
                      <td>{item.notes || 'Brak'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'labs' && canReadClinicalHistory && (
          <div className="lab-grid">
            {records.length === 0 && <div className="card p-3 text-muted">Brak wyników.</div>}
            {records.map(record => (
              <div key={record._id} className="card p-3 mb-3">
                <strong>{new Date(record.visitDate).toLocaleDateString()}</strong>
                <div className="mt-3"><DynamicResultsView data={record.dynamicResults || {}} /></div>
              </div>
            ))}
          </div>
        )}

        {tab === 'meds' && canReadClinicalHistory && (
          <div className="card p-3">
            {prescriptions.length === 0 ? 'Brak leków' : prescriptions.map((item, index) => (
              <div key={`${item.recordId}-${index}`} className="border-bottom py-2 d-flex flex-column flex-md-row justify-content-between gap-1">
                <span><strong>{item.medicationName}</strong> · {item.dosage}</span>
                <small className="text-muted">{new Date(item.visitDate).toLocaleDateString()}</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
