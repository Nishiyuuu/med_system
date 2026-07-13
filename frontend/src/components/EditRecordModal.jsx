import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function EditRecordModal({ record, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(buildForm(record));
  const [dynamicResultsText, setDynamicResultsText] = useState(JSON.stringify(record.dynamicResults || {}, null, 2));
  const { setToast } = useToast();

  useEffect(() => {
    setForm(buildForm(record));
    setDynamicResultsText(JSON.stringify(record.dynamicResults || {}, null, 2));
  }, [record]);

  async function submit(e) {
    e.preventDefault();
    try {
      const dynamicResults = JSON.parse(dynamicResultsText || '{}');
      const data = await api(`/records/${record._id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...form, dynamicResults })
      });
      onUpdated(data.record);
      setOpen(false);
      setToast({ variant: 'success', title: 'Gotowe', message: 'Wpis został zaktualizowany' });
    } catch (err) {
      setToast({
        variant: 'danger',
        title: 'Błąd',
        message: err instanceof SyntaxError ? 'Nieprawidłowy JSON w wynikach' : err.message
      });
    }
  }

  function addPrescription() {
    setForm(prev => ({ ...prev, prescriptions: [...prev.prescriptions, { medicationName: '', dosage: '' }] }));
  }

  function updatePrescription(index, field, value) {
    setForm(prev => ({
      ...prev,
      prescriptions: prev.prescriptions.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
    }));
  }

  function removePrescription(index) {
    setForm(prev => ({
      ...prev,
      prescriptions: prev.prescriptions.filter((_item, itemIndex) => itemIndex !== index)
    }));
  }

  return (
    <>
      <button className="btn btn-sm btn-outline-primary" onClick={() => setOpen(true)}>Edytuj</button>
      {open && (
        <div className="modal d-block bg-dark bg-opacity-50">
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <form className="modal-content" onSubmit={submit}>
              <div className="modal-header">
                <h2 className="modal-title fs-5">Edytuj wpis</h2>
                <button type="button" className="btn-close" onClick={() => setOpen(false)} />
              </div>
              <div className="modal-body row g-3">
                <div className="col-md-4">
                  <input className="form-control" placeholder="ICD-10" value={form.diagnosis.icd10Code} onChange={e => setForm({ ...form, diagnosis: { ...form.diagnosis, icd10Code: e.target.value } })} />
                </div>
                <div className="col-md-8">
                  <input className="form-control" placeholder="Opis rozpoznania" value={form.diagnosis.description} onChange={e => setForm({ ...form, diagnosis: { ...form.diagnosis, description: e.target.value } })} />
                </div>
                <div className="col-12"><textarea className="form-control" rows="3" placeholder="Wywiad" value={form.interviewNotes} onChange={e => setForm({ ...form, interviewNotes: e.target.value })} /></div>
                <div className="col-12"><textarea className="form-control" rows="3" placeholder="Badanie przedmiotowe" value={form.physicalExamination} onChange={e => setForm({ ...form, physicalExamination: e.target.value })} /></div>
                <div className="col-12"><textarea className="form-control" rows="3" placeholder="Zalecenia" value={form.recommendations} onChange={e => setForm({ ...form, recommendations: e.target.value })} /></div>

                <div className="col-lg-7">
                  <div className="border rounded p-3 h-100">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h3 className="h6 mb-0">Leki</h3>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={addPrescription}>Dodaj lek</button>
                    </div>
                    {form.prescriptions.map((item, index) => (
                      <div key={index} className="row g-2 align-items-center mb-2">
                        <div className="col-md-5"><input className="form-control" placeholder="Nazwa leku" value={item.medicationName} onChange={e => updatePrescription(index, 'medicationName', e.target.value)} /></div>
                        <div className="col-md-5"><input className="form-control" placeholder="Dawkowanie" value={item.dosage} onChange={e => updatePrescription(index, 'dosage', e.target.value)} /></div>
                        <div className="col-md-2"><button type="button" className="btn btn-outline-danger w-100" onClick={() => removePrescription(index)}>×</button></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-lg-5">
                  <div className="border rounded p-3 h-100">
                    <h3 className="h6">Wyniki dynamiczne</h3>
                    <textarea className="form-control font-monospace" rows="8" value={dynamicResultsText} onChange={e => setDynamicResultsText(e.target.value)} />
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
      )}
    </>
  );
}

function buildForm(record) {
  return {
    diagnosis: {
      icd10Code: record?.diagnosis?.icd10Code || '',
      description: record?.diagnosis?.description || ''
    },
    interviewNotes: record?.interviewNotes || '',
    physicalExamination: record?.physicalExamination || '',
    recommendations: record?.recommendations || '',
    prescriptions: record?.prescriptions || []
  };
}
