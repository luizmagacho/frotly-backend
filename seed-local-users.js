/**
 * seed-local-users.js
 * Run with: node seed-local-users.js
 * Creates/updates admin users in local MongoDB and, if configured, Atlas.
 *
 * Required env vars: SEED_USER_1_EMAIL, SEED_USER_1_PASSWORD
 * Optional: SEED_USER_1_NAME, SEED_USER_2_EMAIL/PASSWORD/NAME (second user is skipped if not set)
 *           MONGODB_URI (default local), MONGODB_ATLAS_URI (Atlas step is skipped if not set)
 */
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const LOCAL_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gestor-frota-pr';
const ATLAS_URI = process.env.MONGODB_ATLAS_URI;

const USERS = [];
if (process.env.SEED_USER_1_EMAIL && process.env.SEED_USER_1_PASSWORD) {
  USERS.push({
    email: process.env.SEED_USER_1_EMAIL,
    name: process.env.SEED_USER_1_NAME || 'Admin',
    password: process.env.SEED_USER_1_PASSWORD,
    role: 'ADMIN',
  });
}
if (process.env.SEED_USER_2_EMAIL && process.env.SEED_USER_2_PASSWORD) {
  USERS.push({
    email: process.env.SEED_USER_2_EMAIL,
    name: process.env.SEED_USER_2_NAME || 'Admin',
    password: process.env.SEED_USER_2_PASSWORD,
    role: 'ADMIN',
  });
}

if (USERS.length === 0) {
  console.error('❌ Set SEED_USER_1_EMAIL and SEED_USER_1_PASSWORD env vars before running this script.');
  process.exit(1);
}

async function seedDatabase(uri, label) {
  console.log(`\nConnecting to ${label}...`);
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log(`✅ Connected to ${label}`);

    const db = client.db();
    const users = db.collection('users');

    for (const u of USERS) {
      const existing = await users.findOne({ email: u.email });
      const hashedPassword = await bcrypt.hash(u.password, 12);

      if (existing) {
        await users.updateOne(
          { email: u.email },
          { $set: { password: hashedPassword, role: u.role, name: u.name, isActive: true, updatedAt: new Date() } }
        );
        console.log(`  🔄 User updated: ${u.email}`);
      } else {
        await users.insertOne({
          email: u.email,
          name: u.name,
          password: hashedPassword,
          role: u.role,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`  🆕 User created: ${u.email}`);
      }
    }
  } catch (error) {
    console.error(`  ❌ Failed to seed ${label}:`, error.message);
  } finally {
    await client.close();
  }
}

async function main() {
  await seedDatabase(LOCAL_URI, 'Local MongoDB');

  if (ATLAS_URI) {
    await seedDatabase(ATLAS_URI, 'MongoDB Atlas');
  } else {
    console.log('\nℹ️  MONGODB_ATLAS_URI not set — skipping Atlas seed.');
  }

  console.log('\n─────────────────────────────────────');
  console.log('  Users seeded:');
  for (const u of USERS) {
    console.log(`  Email : ${u.email}`);
    console.log(`  Role  : ${u.role}`);
    console.log('─────────────────────────────────────');
  }
}

main().catch((err) => {
  console.error('❌ Global script error:', err);
  process.exit(1);
});
