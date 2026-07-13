import 'dotenv/config';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { connectDb } from '../config/db.js';
import { getMongoUri } from '../config/env.js';

const email = process.env.SEED_ADMIN_EMAIL || 'admin@medcenter.local';
const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

async function run() {
  const mongoUri = getMongoUri();
  if (!mongoUri) {
    throw new Error('MONGO_URI or MONGODB_URI is required');
  }

  await connectDb(mongoUri);

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({
    email,
    passwordHash,
    firstName: 'System',
    lastName: 'Administrator',
    role: 'ADMIN',
    isActive: true
  });

  console.log(`Admin created: ${email}`);
  console.log(`Temporary password: ${password}`);
  process.exit(0);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
