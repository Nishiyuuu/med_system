import React from 'react';

export default function DynamicResultsView({ data }) {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return <div className="text-muted">Brak wyników.</div>;
  }
  const rest = stripVitals(data);

  return (
    <div className="dynamic-results">
      {data.vitals && <VitalsRow vitals={data.vitals} />}
      {Object.keys(rest).length > 0 && renderValue(rest)}
    </div>
  );
}

function renderValue(value, keyPath = 'root') {
  if (Array.isArray(value)) {
    return (
      <div className="d-grid gap-2">
        {value.map((item, index) => (
          <div key={`${keyPath}-${index}`} className="border rounded p-2 bg-light">
            {renderValue(item, `${keyPath}-${index}`)}
          </div>
        ))}
      </div>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <dl className="row mb-0">
        {Object.entries(value).map(([key, nestedValue]) => (
          <React.Fragment key={`${keyPath}-${key}`}>
            <dt className="col-sm-4 text-break">{labelize(key)}</dt>
            <dd className="col-sm-8 text-break">{renderValue(nestedValue, `${keyPath}-${key}`)}</dd>
          </React.Fragment>
        ))}
      </dl>
    );
  }

  if (typeof value === 'boolean') {
    return <span className={`badge text-bg-${value ? 'success' : 'secondary'}`}>{value ? 'Tak' : 'Nie'}</span>;
  }

  return <span>{String(value)}</span>;
}

function labelize(value) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, char => char.toUpperCase());
}

function stripVitals(data) {
  const { vitals: _vitals, ...rest } = data;
  return rest;
}

function VitalsRow({ vitals }) {
  const items = [
    ['Temperatura', vitals.temperatureC, '°C'],
    ['Tętno', vitals.pulseBpm, '/min'],
    ['Ciśnienie', vitals.systolicMmHg && vitals.diastolicMmHg ? `${vitals.systolicMmHg}/${vitals.diastolicMmHg}` : '', 'mmHg'],
    ['SpO₂', vitals.spo2Percent, '%'],
    ['Masa', vitals.weightKg, 'kg']
  ].filter(([_label, value]) => value !== undefined && value !== '');

  if (items.length === 0) return null;

  return (
    <div className="d-flex flex-wrap gap-2 mb-3">
      {items.map(([label, value, unit]) => (
        <span key={label} className="badge rounded-pill text-bg-light border">
          {label}: {value}{unit ? ` ${unit}` : ''}
        </span>
      ))}
    </div>
  );
}
