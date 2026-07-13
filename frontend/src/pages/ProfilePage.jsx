import React, { useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { roleLabel } from '../utils/labels.js';

export default function ProfilePage() {
  const { user } = useAuth();
  const { setToast } = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  async function submit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setToast({ variant: 'warning', title: 'Hasło', message: 'Nowe hasła nie są zgodne' });
      return;
    }
    if (form.newPassword.length < 8) {
      setToast({ variant: 'warning', title: 'Hasło', message: 'Nowe hasło musi mieć co najmniej 8 znaków' });
      return;
    }
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword
        })
      });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setToast({ variant: 'success', title: 'Gotowe', message: 'Hasło zostało zmienione' });
    } catch (err) {
      setToast({ variant: 'danger', title: 'Błąd', message: err.message });
    }
  }

  return (
    <div className="row g-4">
      <div className="col-lg-5">
        <div className="card p-3">
          <h2 className="h5">Ustawienia konta</h2>
          <div><strong>{user.firstName} {user.lastName}</strong></div>
          <div className="text-muted">{user.email}</div>
          <div className="mt-2"><span className="badge text-bg-dark">{roleLabel(user.role)}</span></div>
        </div>
      </div>
      <div className="col-lg-7">
        <form className="card p-3" onSubmit={submit}>
          <h2 className="h5">Zmień hasło</h2>
          <input className="form-control mb-2" type="password" placeholder="Aktualne hasło" value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} />
          <input className="form-control mb-2" type="password" placeholder="Nowe hasło" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} />
          <input className="form-control mb-3" type="password" placeholder="Powtórz nowe hasło" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
          <button className="btn btn-primary">Zaktualizuj hasło</button>
        </form>
      </div>
    </div>
  );
}
