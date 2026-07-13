import React from 'react';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function PrintSummaryButton({ patientId }) {
  const { setToast } = useToast();

  async function printSummary() {
    try {
      const data = await api(`/patients/${patientId}/summary`);
      const popup = window.open('', '_blank', 'width=900,height=700');
      if (!popup) {
        setToast({ variant: 'warning', title: 'Przeglądarka', message: 'Zezwól na wyskakujące okna, aby wydrukować podsumowanie' });
        return;
      }
      popup.document.write(buildHtml(data));
      popup.document.close();
      popup.focus();
      popup.print();
    } catch (err) {
      setToast({ variant: 'danger', title: 'Błąd', message: err.message });
    }
  }

  return <button className="btn btn-outline-primary" onClick={printSummary}>Drukuj podsumowanie</button>;
}

function buildHtml({ patient, summary }) {
  const latest = summary.latestVisit;
  const rows = summary.records.map(record => `
    <tr>
      <td>${formatDate(record.visitDate)}</td>
      <td>${escapeHtml(record.diagnosis?.description || '—')}</td>
      <td>${escapeHtml(record.recommendations || '—')}</td>
    </tr>
  `).join('');

  const meds = summary.prescriptions.length
    ? summary.prescriptions.map(item => `<li>${escapeHtml(item.medicationName)} — ${escapeHtml(item.dosage)}</li>`).join('')
    : '<li>Brak</li>';

  return `
    <!doctype html>
    <html lang="pl">
      <head>
        <meta charset="utf-8" />
        <title>Podsumowanie pacjenta</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1f2937; margin: 32px; }
          h1, h2 { margin-bottom: 8px; }
          .meta { margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; }
          section { margin-top: 24px; }
        </style>
      </head>
      <body>
        <h1>Podsumowanie kliniczne</h1>
        <div class="meta">
          <strong>${escapeHtml(patient.lastName)} ${escapeHtml(patient.firstName)}</strong><br />
          PESEL: ${escapeHtml(patient.pesel)}<br />
          Data urodzenia: ${formatDate(patient.dateOfBirth)}
        </div>
        <section>
          <h2>Ostatnia wizyta</h2>
          <div>${latest ? `${formatDate(latest.visitDate)} — ${escapeHtml(latest.diagnosis?.description || '—')}` : 'Brak wpisów'}</div>
        </section>
        <section>
          <h2>Historia wizyt</h2>
          <table>
            <thead><tr><th>Data</th><th>Rozpoznanie</th><th>Zalecenia</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="3">Brak wpisów</td></tr>'}</tbody>
          </table>
        </section>
        <section>
          <h2>Leki</h2>
          <ul>${meds}</ul>
        </section>
      </body>
    </html>
  `;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('pl-PL') : '—';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
