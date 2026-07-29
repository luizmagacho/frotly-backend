/**
 * seed-admin.js
 * Run with: node seed-admin.js
 * Creates (or updates) the admin user in local MongoDB.
 *
 * Required env vars: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 * Optional: SEED_ADMIN_NAME (default "Admin"), MONGODB_URI (default local)
 *
 * Deliberately not named ADMIN_EMAIL/ADMIN_PASSWORD: this app already reads
 * ADMIN_EMAIL elsewhere (notifications.service.ts) as the admin-alert
 * recipient — reusing that name here would silently redirect alert emails
 * to whatever address you're seeding.
 */
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gestor-frota-pr';

const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL,
  name: process.env.SEED_ADMIN_NAME || 'Admin',
  password: process.env.SEED_ADMIN_PASSWORD,
  role: 'ADMIN',
  isActive: true,
};

if (!ADMIN.email || !ADMIN.password) {
  console.error('❌ Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD env vars before running this script.');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const users = db.collection('users');
    const tenants = db.collection('tenants');

    let tenant = await tenants.findOne({ name: 'Locadora Padrão' });
    if (!tenant) {
      const result = await tenants.insertOne({
        name: 'Locadora Padrão',
        cnpj: '00000000000000',
        plan: 'PRO',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      tenant = { _id: result.insertedId };
    }

    const existing = await users.findOne({ email: ADMIN.email });
    const hashedPassword = await bcrypt.hash(ADMIN.password, 12);

    if (existing) {
      await users.updateOne(
        { email: ADMIN.email },
        { $set: { password: hashedPassword, role: ADMIN.role, tenantId: tenant._id, isActive: true, updatedAt: new Date() } },
      );
      console.log(`🔄 Admin user updated: ${ADMIN.email}`);
    } else {
      await users.insertOne({
        email: ADMIN.email,
        name: ADMIN.name,
        password: hashedPassword,
        role: ADMIN.role,
        tenantId: tenant._id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`🆕 Admin user created: ${ADMIN.email}`);
    }

    console.log('');
    console.log('─────────────────────────────────────');
    console.log('  Admin user ready:');
    console.log(`  Email : ${ADMIN.email}`);
    console.log(`  Role  : ${ADMIN.role}`);
    console.log('─────────────────────────────────────');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
