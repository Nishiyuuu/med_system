import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { getClientIp } from '../middlewares/audit.js';
import AuditLog from '../models/AuditLog.js';
import { assertPassword, isValidEmail, normalizeEmail } from '../utils/requestValidation.js';

export async function login(req, res) {
  const email = normalizeEmail(req.body?.email);
  const { password } = req.body || {};

  if (!isValidEmail(email) || typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ message: 'Podaj poprawny email i hasło' });
  }

  const user = await User.findOne({ email, isActive: true });
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    await AuditLog.create({
      action: 'FAILED_LOGIN',
      entity: 'Auth',
      description: email ? `Nieudana próba logowania: ${email}` : 'Nieudana próba logowania',
      ipAddress: getClientIp(req)
    }).catch(() => {});
    return res.status(401).json({ message: 'Nieprawidłowy login lub hasło' });
  }
  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  await AuditLog.create({
    userId: user._id,
    action: 'LOGIN',
    entity: 'User',
    entityId: user._id,
    description: 'Pomyślne logowanie',
    ipAddress: getClientIp(req)
  });
  const csrfToken = crypto.randomBytes(32).toString('hex');
  res.cookie('accessToken', token, { ...accessTokenCookieOptions(), maxAge: 8 * 60 * 60 * 1000 });
  res.cookie('csrfToken', csrfToken, { ...csrfTokenCookieOptions(), maxAge: 8 * 60 * 60 * 1000 });
  res.json({ csrfToken, user: user.toJSON() });
}

export async function me(req, res) {
  res.json({ user: req.user.toJSON() });
}

export async function logout(_req, res) {
  res.clearCookie('accessToken', accessTokenCookieOptions());
  res.clearCookie('csrfToken', csrfTokenCookieOptions());
  res.status(204).send();
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
    return res.status(400).json({ message: 'Podaj aktualne hasło' });
  }
  assertPassword(newPassword, 'Nowe hasło');
  const validCurrentPassword = await bcrypt.compare(currentPassword || '', req.user.passwordHash);
  if (!validCurrentPassword) {
    return res.status(400).json({ message: 'Aktualne hasło jest nieprawidłowe' });
  }
  req.user.passwordHash = await bcrypt.hash(newPassword, 12);
  await req.user.save();
  res.status(204).send();
}

function accessTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  };
}

function csrfTokenCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  };
}
