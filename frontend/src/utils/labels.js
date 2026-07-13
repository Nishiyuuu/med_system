export const roleLabels = {
  ADMIN: 'Administrator',
  DOCTOR: 'Lekarz',
  RECEPTIONIST: 'Recepcjonista',
  PATIENT: 'Pacjent'
};

export const appointmentStatusLabels = {
  SCHEDULED: 'Zaplanowana',
  COMPLETED: 'Zakończona',
  CANCELLED: 'Anulowana'
};

export const auditActionLabels = {
  LOGIN: 'Logowanie',
  FAILED_LOGIN: 'Nieudane logowanie',
  VIEW_EHR: 'Podgląd dokumentacji',
  CREATE_EHR: 'Dodanie dokumentacji',
  UPDATE_EHR: 'Aktualizacja dokumentacji',
  CREATE_PATIENT: 'Dodanie pacjenta',
  UPDATE_PATIENT: 'Aktualizacja pacjenta',
  CREATE_APPOINTMENT: 'Dodanie wizyty',
  UPDATE_APPOINTMENT: 'Aktualizacja wizyty',
  CREATE_USER: 'Dodanie użytkownika',
  UPDATE_USER: 'Aktualizacja użytkownika',
  ROLE_CHANGE: 'Zmiana roli',
  EXPORT_DATA: 'Eksport danych'
};

export function roleLabel(role) {
  return roleLabels[role] || role || 'Brak roli';
}

export function appointmentStatusLabel(status) {
  return appointmentStatusLabels[status] || status || 'Brak statusu';
}

export function appointmentStatusBadgeClass(status) {
  if (status === 'SCHEDULED') return 'text-bg-primary';
  if (status === 'COMPLETED') return 'text-bg-success';
  if (status === 'CANCELLED') return 'text-bg-secondary';
  return 'text-bg-light';
}

export function auditActionLabel(action) {
  return auditActionLabels[action] || action || 'Brak akcji';
}
