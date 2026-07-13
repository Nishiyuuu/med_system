export function requireCsrf(req, res, next) {
  if (req.path === '/api/auth/login' || req.path === '/api/auth/logout') {
    return next();
  }

  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const usesBearerToken = req.headers.authorization?.startsWith('Bearer ');
  const usesCookieSession = Boolean(req.cookies?.accessToken);
  if (!usesCookieSession || usesBearerToken) {
    return next();
  }

  const csrfCookie = req.cookies?.csrfToken;
  const csrfHeader = req.headers['x-csrf-token'];
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ message: 'Nieprawidłowy token CSRF' });
  }

  next();
}
