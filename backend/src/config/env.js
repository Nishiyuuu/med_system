const requiredServerEnv = ['JWT_SECRET'];

export function assertRequiredServerEnv(env = process.env) {
  const missing = requiredServerEnv.filter(key => !env[key]);
  if (!env.MONGO_URI && !env.MONGODB_URI) {
    missing.push('MONGO_URI lub MONGODB_URI');
  }
  if (!env.CLIENT_URL) {
    missing.push('CLIENT_URL');
  }
  if (missing.length > 0) {
    throw new Error(`Brak wymaganych zmiennych środowiskowych: ${missing.join(', ')}`);
  }
}

export function getMongoUri(env = process.env) {
  return env.MONGO_URI || env.MONGODB_URI;
}

export function getClientUrls(env = process.env) {
  return (env.CLIENT_URL || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}
