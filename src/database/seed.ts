// สร้างบัญชีแรก: npm run seed
// อ่านอีเมล/รหัสจาก SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD ใน .env · มีอยู่แล้วจะข้าม
import bcrypt from 'bcryptjs';
import dataSource from './database.config.js';

const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('ตั้ง SEED_ADMIN_EMAIL และ SEED_ADMIN_PASSWORD ใน .env ก่อน');
  process.exit(1);
}

await dataSource.initialize();
const hash = await bcrypt.hash(password, 12);
const rows: unknown[] = await dataSource.query(
  `INSERT INTO users (email, password) VALUES ($1, $2)
   ON CONFLICT (email) DO NOTHING
   RETURNING id`,
  [email, hash],
);
console.log(rows.length ? `สร้างบัญชี ${email} แล้ว` : `มีบัญชี ${email} อยู่แล้ว ข้าม`);
await dataSource.destroy();
