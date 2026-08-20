/**
 * One-time password reset script — NOT committed to git.
 * Usage: MONGODB_URI=<uri> TARGET_EMAIL=<email> npx ts-node scripts/reset-user-password.ts
 */
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

async function main() {
  const uri = process.env.MONGODB_URI;
  const targetEmail = process.env.TARGET_EMAIL;

  if (!uri || !targetEmail) {
    console.error('MONGODB_URI and TARGET_EMAIL env vars are required.');
    process.exit(1);
  }

  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;

  if (!db) {
    console.error('Could not connect to database');
    process.exit(1);
  }

  // Generate a cryptographically secure random password
  const newPassword =
    crypto.randomBytes(12).toString('base64url').slice(0, 16) +
    '!A1'; // guaranteed special, upper, number chars

  const hash = await bcrypt.hash(newPassword, 12);

  const result = await db.collection('users').updateOne(
    { email: targetEmail },
    { $set: { password: hash, updatedAt: new Date() } },
  );

  if (result.matchedCount === 0) {
    console.error(`❌  No user found with email: ${targetEmail}`);
  } else {
    console.log(`✅  Password updated successfully for ${targetEmail}`);
    console.log(`🔑  NEW PASSWORD: ${newPassword}`);
    console.log(`⚠️   Copy this now — it will NOT be stored anywhere.`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
