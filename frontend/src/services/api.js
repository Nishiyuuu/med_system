const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const csrfToken = readCookie('csrfToken');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Żądanie nie powiodło się');
  }
  return data;
}

function readCookie(name) {
  return document.cookie
    .split('; ')
    .find(item => item.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}
