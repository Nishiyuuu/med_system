import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function EditPatientModal({ patient, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(buildForm(patient));
  const [formError, setFormError] = useState('');
  const [doctors, setDoctors] = useState([]);
  const { setToast } = useToast();

  useEffect(() => {
    setForm(buildForm(patient));
  }, [patient]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('modal-open');

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    api('/appointments/doctors')
      .then(data => setDoctors(data.doctors))
      .catch(err => setToast({ variant: 'danger', title: 'Błąd', message: err.message }));
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    const validationError = validatePatientForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError('');
    try {
      const data = await api(`/patients/${patient._id}`, {
        method: 'PUT',
        body: JSON.stringify(form)
      });
      onUpdated(data.patient);
      setOpen(false);
      setToast({ variant: 'success', title: 'Gotowe', message: 'Profil pacjenta został zaktualizowany' });
    } catch (err) {
      setToast({ variant: 'danger', title: 'Błąd', message: err.message });
    }
  }

  function addAllergy() {
    setForm(prev => ({
      ...prev,
      allergies: [...prev.allergies, { substance: '', reaction: '', severity: 'LOW' }]
    }));
  }

  function updateAllergy(index, field, value) {
    setForm(prev => ({
      ...prev,
      allergies: prev.allergies.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
    }));
  }

  function removeAllergy(index) {
    setForm(prev => ({
      ...prev,
      allergies: prev.allergies.filter((_item, itemIndex) => itemIndex !== index)
    }));
  }

  function addCondition() {
    setForm(prev => ({
      ...prev,
      chronicConditions: [...prev.chronicConditions, { name: '', icd10Code: '' }]
    }));
  }

  function updateCondition(index, field, value) {
    setForm(prev => ({
      ...prev,
      chronicConditions: prev.chronicConditions.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
    }));
  }

  function removeCondition(index) {
    setForm(prev => ({
      ...prev,
      chronicConditions: prev.chronicConditions.filter((_item, itemIndex) => itemIndex !== index)
    }));
  }

  return (
    <>
      <button type="button" className="btn btn-outline-secondary" onClick={() => setOpen(true)}>Edytuj profil</button>
      {open && createPortal(
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="edit-patient-title">
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <form className="modal-content" onSubmit={submit}>
                <div className="modal-header">
                  <h2 id="edit-patient-title" className="modal-title fs-5">Profil pacjenta</h2>
                  <button type="button" className="btn-close" aria-label="Zamknij" onClick={() => setOpen(false)} />
                </div>
                <div className="modal-body row g-3">
                  {formError && <div className="col-12"><div className="alert alert-warning py-2 mb-0">{formError}</div></div>}
                  <div className="col-md-6"><input className="form-control" placeholder="Imię" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required /></div>
                  <div className="col-md-6"><input className="form-control" placeholder="Nazwisko" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required /></div>
                  <div className="col-md-6"><input className="form-control" type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} required /></div>
                  <div className="col-md-6">
                    <select className="form-select" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} required>
                      <option value="">Płeć</option>
                      <option value="F">Kobieta</option>
                      <option value="M">Mężczyzna</option>
                      <option value="Inna">Inna</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                      <option value="ACTIVE">Aktywny</option>
                      <option value="ARCHIVED">Archiwalny</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <select className="form-select" value={form.primaryDoctorId} onChange={e => setForm({ ...form, primaryDoctorId: e.target.value })}>
                      <option value="">Lekarz prowadzący</option>
                      {doctors.map(doctor => (
                        <option key={doctor._id} value={doctor._id}>{doctor.lastName} {doctor.firstName}{doctor.specialization ? `, ${doctor.specialization}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6"><input className="form-control" placeholder="Telefon" value={form.contact.phone} onChange={e => setForm({ ...form, contact: { ...form.contact, phone: e.target.value } })} /></div>
                  <div className="col-md-6"><input className="form-control" type="email" placeholder="Email" value={form.contact.email} onChange={e => setForm({ ...form, contact: { ...form.contact, email: e.target.value } })} /></div>
                  <div className="col-12"><input className="form-control" placeholder="Adres" value={form.contact.address} onChange={e => setForm({ ...form, contact: { ...form.contact, address: e.target.value } })} /></div>
                  <div className="col-md-6"><input className="form-control" placeholder="Osoba kontaktowa" value={form.emergencyContact.name} onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, name: e.target.value } })} /></div>
                  <div className="col-md-6"><input className="form-control" placeholder="Telefon osoby kontaktowej" value={form.emergencyContact.phone} onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, phone: e.target.value } })} /></div>
                  <div className="col-12">
                    <div className="border rounded p-3">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h3 className="h6 mb-0">Alergie</h3>
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={addAllergy}>Dodaj alergię</button>
                      </div>
                      {form.allergies.length === 0 && <div className="text-muted">Brak zapisanych alergii.</div>}
                      {form.allergies.map((allergy, index) => (
                        <div key={index} className="row g-2 align-items-center mb-2">
                          <div className="col-md-4"><input className="form-control" placeholder="Substancja" value={allergy.substance} onChange={e => updateAllergy(index, 'substance', e.target.value)} /></div>
                          <div className="col-md-4"><input className="form-control" placeholder="Reakcja" value={allergy.reaction} onChange={e => updateAllergy(index, 'reaction', e.target.value)} /></div>
                          <div className="col-md-3">
                            <select className="form-select" value={allergy.severity} onChange={e => updateAllergy(index, 'severity', e.target.value)}>
                              <option value="LOW">Niska</option>
                              <option value="MEDIUM">Średnia</option>
                              <option value="HIGH">Wysoka</option>
                            </select>
                          </div>
                          <div className="col-md-1"><button type="button" className="btn btn-outline-danger w-100" onClick={() => removeAllergy(index)}>×</button></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="border rounded p-3">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h3 className="h6 mb-0">Choroby przewlekłe</h3>
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={addCondition}>Dodaj chorobę</button>
                      </div>
                      {form.chronicConditions.length === 0 && <div className="text-muted">Brak chorób przewlekłych.</div>}
                      {form.chronicConditions.map((condition, index) => (
                        <div key={index} className="row g-2 align-items-center mb-2">
                          <div className="col-md-7"><input className="form-control" placeholder="Nazwa choroby" value={condition.name} onChange={e => updateCondition(index, 'name', e.target.value)} /></div>
                          <div className="col-md-4"><input className="form-control" placeholder="ICD-10" value={condition.icd10Code} onChange={e => updateCondition(index, 'icd10Code', e.target.value)} /></div>
                          <div className="col-md-1"><button type="button" className="btn btn-outline-danger w-100" onClick={() => removeCondition(index)}>×</button></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Anuluj</button>
                  <button className="btn btn-primary">Zapisz</button>
                </div>
              </form>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function buildForm(patient) {
  return {
    firstName: patient?.firstName || '',
    lastName: patient?.lastName || '',
    dateOfBirth: patient?.dateOfBirth ? patient.dateOfBirth.slice(0, 10) : '',
    gender: patient?.gender || '',
    status: patient?.status || 'ACTIVE',
    primaryDoctorId: typeof patient?.primaryDoctorId === 'object' ? patient.primaryDoctorId?._id || '' : patient?.primaryDoctorId || '',
    contact: {
      phone: patient?.contact?.phone || '',
      email: patient?.contact?.email || '',
      address: patient?.contact?.address || ''
    },
    emergencyContact: {
      name: patient?.emergencyContact?.name || '',
      phone: patient?.emergencyContact?.phone || ''
    },
    allergies: patient?.allergies || [],
    chronicConditions: patient?.chronicConditions || []
  };
}

function validatePatientForm(form) {
  if (!form.firstName.trim() || !form.lastName.trim()) return 'Podaj imię i nazwisko pacjenta.';
  if (!form.dateOfBirth) return 'Podaj datę urodzenia pacjenta.';
  if (!form.gender) return 'Wybierz płeć pacjenta.';
  if (form.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact.email)) {
    return 'Podaj poprawny email pacjenta.';
  }
  return '';
}
