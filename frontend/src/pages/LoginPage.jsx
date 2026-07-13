import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login, ready, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Podaj email i hasło.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (ready && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="login-page min-vh-100 d-flex align-items-center justify-content-center p-3">
      <form className="card shadow-sm p-4 login-card" onSubmit={submit}>
        <h1 className="h4 mb-1">Centrum Medyczne</h1>
        <p className="text-muted mb-4">Logowanie do systemu</p>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="mb-3">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            className="form-control"
            type="email"
            autoComplete="username"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="password">Hasło</label>
          <input
            id="password"
            className="form-control"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary w-100" disabled={submitting}>
          {submitting ? 'Logowanie...' : 'Zaloguj się'}
        </button>
      </form>
    </div>
  );
}
