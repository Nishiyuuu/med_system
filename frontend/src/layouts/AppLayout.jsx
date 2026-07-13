import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { roleLabel } from '../utils/labels.js';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  async function searchPatients(value) {
    setQuery(value);
    if (value.length < 2) return setResults([]);
    try {
      const data = await api(`/patients?search=${encodeURIComponent(value)}&limit=5`);
      setResults(data.items);
    } catch {
      setResults([]);
    }
  }

  function goToPatient(patientId) {
    navigate(`/patients/${patientId}`);
    setResults([]);
    setMobileOpen(false);
  }

  return (
    <div className="app-shell d-flex">
      <aside className="sidebar bg-dark text-white p-3 d-none d-lg-flex flex-column">
        <Brand user={user} />
        {user.role !== 'PATIENT' && (
          <PatientSearch query={query} results={results} onSearch={searchPatients} onSelect={goToPatient} />
        )}
        <RoleNav user={user} />
        <button className="btn btn-outline-light mt-auto" onClick={logout}>Wyloguj</button>
      </aside>

      <div className="flex-grow-1 min-w-0">
        <header className="navbar navbar-dark bg-dark d-lg-none px-3">
          <button className="btn btn-outline-light btn-sm" onClick={() => setMobileOpen(prev => !prev)}>Menu</button>
          <span className="navbar-brand mb-0 h1 fs-6">Centrum Medyczne</span>
          <span className="badge text-bg-info">{roleLabel(user.role)}</span>
        </header>

        {mobileOpen && (
          <div className="mobile-panel d-lg-none bg-dark text-white p-3">
            {user.role !== 'PATIENT' && (
              <PatientSearch query={query} results={results} onSearch={searchPatients} onSelect={goToPatient} />
            )}
            <RoleNav user={user} onNavigate={() => setMobileOpen(false)} />
            <div className="d-grid gap-2 mt-3">
              <button className="btn btn-outline-light" onClick={logout}>Wyloguj</button>
            </div>
          </div>
        )}

        <main className="content-pane p-3 p-lg-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Brand({ user }) {
  return (
    <>
      <h1 className="h4 mb-1">Centrum Medyczne</h1>
      <span className="badge text-bg-info align-self-start mb-4">{roleLabel(user.role)}</span>
    </>
  );
}

function PatientSearch({ query, results, onSearch, onSelect }) {
  return (
    <div className="position-relative mb-4">
      <input className="form-control" placeholder="Szukaj pacjenta..." value={query} onChange={e => onSearch(e.target.value)} />
      {results.length > 0 && (
        <div className="list-group position-absolute w-100 mt-1 shadow search-results">
          {results.map(patient => (
            <button key={patient._id} className="list-group-item list-group-item-action" onClick={() => onSelect(patient._id)}>
              {patient.lastName} {patient.firstName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleNav({ user, onNavigate }) {
  const navClass = ({ isActive }) => `nav-link text-white ${isActive ? 'active bg-primary' : ''}`;
  const patientId = typeof user.patientId === 'object' ? user.patientId?._id : user.patientId;

  return (
    <nav className="nav nav-pills flex-column gap-2">
      <NavLink className={navClass} to="/dashboard" onClick={onNavigate}>Panel główny</NavLink>
      {user.role === 'PATIENT' && patientId && (
        <NavLink className={navClass} to={`/patients/${patientId}`} onClick={onNavigate}>Moja dokumentacja</NavLink>
      )}
      {user.role !== 'PATIENT' && <NavLink className={navClass} to="/patients" onClick={onNavigate}>Pacjenci</NavLink>}
      <NavLink className={navClass} to="/appointments" onClick={onNavigate}>Wizyty</NavLink>
      <NavLink className={navClass} to="/doctors" onClick={onNavigate}>Lekarze</NavLink>
      {user.role === 'ADMIN' && <NavLink className={navClass} to="/admin" onClick={onNavigate}>Administracja</NavLink>}
      <NavLink className={navClass} to="/profile" onClick={onNavigate}>Ustawienia</NavLink>
    </nav>
  );
}
