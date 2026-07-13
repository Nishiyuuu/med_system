import React, { useState } from 'react';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

const blankForm = {
  diagnosis: { icd10Code: '', description: '' },
  interviewNotes: '',
  physicalExamination: '',
  recommendations: '',
  prescriptions: [],
  dynamicResults: {}
};

const encounterTemplates = [
  {
    label: 'Infekcja górnych dróg oddechowych',
    form: {
      diagnosis: { icd10Code: 'J06.9', description: 'Ostra infekcja górnych dróg oddechowych' },
      interviewNotes: 'Katar, ból gardła, osłabienie i podwyższona temperatura.',
      physicalExamination: 'Stan ogólny dobry. Gardło zaczerwienione. Szmer pęcherzykowy prawidłowy.',
      recommendations: 'Nawadnianie, leczenie objawowe, kontrola temperatury.'
    }
  },
  {
    label: 'Kontrola ciśnienia',
    form: {
      diagnosis: { icd10Code: 'I10', description: 'Nadciśnienie tętnicze pierwotne' },
      interviewNotes: 'Wizyta kontrolna. Pacjent stosuje zaleconą terapię.',
      physicalExamination: 'Stan stabilny. Tętno miarowe.',
      recommendations: 'Kontynuować terapię, domowy pomiar ciśnienia, wizyta kontrolna.'
    }
  },
  {
    label: 'Badanie ogólne',
    form: {
      diagnosis: { icd10Code: '', description: 'Badanie profilaktyczne' },
      interviewNotes: 'W chwili badania pacjent nie zgłasza dolegliwości.',
      physicalExamination: 'Stan ogólny dobry.',
      recommendations: 'Zalecenia profilaktyczne, kontrola w razie potrzeby.'
    }
  }
];

export default function VisitEncounterModal({ patientId, onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [dynamicResultsText, setDynamicResultsText] = useState('{}');
  const [vitals, setVitals] = useState({
    temperatureC: '',
    pulseBpm: '',
    systolicMmHg: '',
    diastolicMmHg: '',
    spo2Percent: '',
    weightKg: ''
  });
  const { setToast } = useToast();

  async function submit(e) {
    e.preventDefault();
    try {
      const dynamicResults = {
        ...JSON.parse(dynamicResultsText || '{}'),
        ...(hasVitals(vitals) ? { vitals: normalizeVitals(vitals) } : {})
      };
      const data = await api('/records', {
        method: 'POST',
        body: JSON.stringify({ ...form, dynamicResults, patientId })
      });
      onCreated(data.record);
      setForm(blankForm);
      setDynamicResultsText('{}');
      setVitals({
        temperatureC: '',
        pulseBpm: '',
        systolicMmHg: '',
        diastolicMmHg: '',
        spo2Percent: '',
        weightKg: ''
      });
      setOpen(false);
      setToast({ variant: 'success', title: 'Zapisano', message: 'Wizyta została dodana do historii' });
    } catch (err) {
      setToast({
        variant: 'danger',
        title: 'Błąd',
        message: err instanceof SyntaxError ? 'Nieprawidłowy JSON w wynikach' : err.message
      });
    }
  }

  function addPrescription() {
    setForm(prev => ({
      ...prev,
      prescriptions: [...prev.prescriptions, { medicationName: '', dosage: '' }]
    }));
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

  function applyTemplate(template) {
    setForm(prev => ({
      ...prev,
      ...template.form
    }));
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>Nowa wizyta</button>
      {open && (
        <div className="modal d-block bg-dark bg-opacity-50">
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <form className="modal-content" onSubmit={submit}>
              <div className="modal-header">
                <h2 className="modal-title fs-5">Wizyta</h2>
                <button type="button" className="btn-close" onClick={() => setOpen(false)} />
              </div>
              <div className="modal-body row g-3">
                <div className="col-12">
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <span className="small text-muted">Szablony:</span>
                    {encounterTemplates.map(template => (
                      <button key={template.label} type="button" className="btn btn-sm btn-outline-secondary" onClick={() => applyTemplate(template)}>
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-md-4">
                  <input
                    className="form-control"
                    list="icd10-codes"
                    placeholder="ICD-10"
                    value={form.diagnosis.icd10Code}
                    onChange={e => setForm({ ...form, diagnosis: { ...form.diagnosis, icd10Code: e.target.value } })}
                  />
                  <datalist id="icd10-codes">
                    <option value="I10">Nadciśnienie tętnicze</option>
                    <option value="E11">Cukrzyca typu 2</option>
                    <option value="J06.9">Infekcja górnych dróg oddechowych</option>
                    <option value="M54.5">Ból odcinka lędźwiowego</option>
                  </datalist>
                </div>
                <div className="col-md-8">
                  <input className="form-control" placeholder="Opis rozpoznania" value={form.diagnosis.description} onChange={e => setForm({ ...form, diagnosis: { ...form.diagnosis, description: e.target.value } })} />
                </div>
                <div className="col-12"><textarea className="form-control" rows="3" placeholder="Wywiad" value={form.interviewNotes} onChange={e => setForm({ ...form, interviewNotes: e.target.value })} /></div>
                <div className="col-12"><textarea className="form-control" rows="3" placeholder="Badanie przedmiotowe" value={form.physicalExamination} onChange={e => setForm({ ...form, physicalExamination: e.target.value })} /></div>
                <div className="col-12"><textarea className="form-control" rows="3" placeholder="Zalecenia" value={form.recommendations} onChange={e => setForm({ ...form, recommendations: e.target.value })} /></div>

                <div className="col-12">
                  <div className="border rounded p-3">
                    <h3 className="h6">Szybkie parametry</h3>
                    <div className="row g-2">
                      <div className="col-sm-6 col-lg-2"><input className="form-control" type="number" step="0.1" placeholder="°C" value={vitals.temperatureC} onChange={e => setVitals({ ...vitals, temperatureC: e.target.value })} /></div>
                      <div className="col-sm-6 col-lg-2"><input className="form-control" type="number" placeholder="Tętno" value={vitals.pulseBpm} onChange={e => setVitals({ ...vitals, pulseBpm: e.target.value })} /></div>
                      <div className="col-sm-6 col-lg-2"><input className="form-control" type="number" placeholder="Ciśn. skurcz." value={vitals.systolicMmHg} onChange={e => setVitals({ ...vitals, systolicMmHg: e.target.value })} /></div>
                      <div className="col-sm-6 col-lg-2"><input className="form-control" type="number" placeholder="Ciśn. rozkurcz." value={vitals.diastolicMmHg} onChange={e => setVitals({ ...vitals, diastolicMmHg: e.target.value })} /></div>
                      <div className="col-sm-6 col-lg-2"><input className="form-control" type="number" placeholder="SpO₂ %" value={vitals.spo2Percent} onChange={e => setVitals({ ...vitals, spo2Percent: e.target.value })} /></div>
                      <div className="col-sm-6 col-lg-2"><input className="form-control" type="number" step="0.1" placeholder="Masa kg" value={vitals.weightKg} onChange={e => setVitals({ ...vitals, weightKg: e.target.value })} /></div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-7">
                  <div className="border rounded p-3 h-100">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h3 className="h6 mb-0">Leki</h3>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={addPrescription}>Dodaj lek</button>
                    </div>
                    {form.prescriptions.length === 0 && <div className="text-muted">Na razie bez zaleconych leków.</div>}
                    {form.prescriptions.map((item, index) => (
                      <div key={index} className="row g-2 align-items-center mb-2">
                        <div className="col-md-5">
                          <input className="form-control" placeholder="Nazwa leku" value={item.medicationName} onChange={e => updatePrescription(index, 'medicationName', e.target.value)} />
                        </div>
                        <div className="col-md-5">
                          <input className="form-control" placeholder="Dawkowanie" value={item.dosage} onChange={e => updatePrescription(index, 'dosage', e.target.value)} />
                        </div>
                        <div className="col-md-2">
                          <button type="button" className="btn btn-outline-danger w-100" onClick={() => removePrescription(index)}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-lg-5">
                  <div className="border rounded p-3 h-100">
                    <h3 className="h6">Wyniki dynamiczne</h3>
                    <textarea
                      className="form-control font-monospace"
                      rows="8"
                      value={dynamicResultsText}
                      onChange={e => setDynamicResultsText(e.target.value)}
                    />
                    <small className="text-muted">JSON dla wyników laboratoryjnych, metadanych obrazowania lub parametrów niestandardowych.</small>
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

function hasVitals(vitals) {
  return Object.values(vitals).some(value => value !== '');
}

function normalizeVitals(vitals) {
  return Object.fromEntries(
    Object.entries(vitals)
      .filter(([_key, value]) => value !== '')
      .map(([key, value]) => [key, Number(value)])
  );
}
