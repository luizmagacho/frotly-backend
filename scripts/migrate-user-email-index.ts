// One-off migration: email used to be unique platform-wide; now it's unique
// per tenant instead (a user's email can legitimately repeat across tenants).
// Run once against any existing database: MONGODB_URI=... npx ts-node scripts/migrate-user-email-index.ts
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gestor-frota-pr';

async function migrate() {
  await mongoose.connect(MONGO_URI);
  const collection = mongoose.connection.collection('users');

  const existingIndexes = await collection.indexes();
  const oldIndex = existingIndexes.find(
    (idx) => idx.key && Object.keys(idx.key).length === 1 && idx.key.email === 1 && idx.unique,
  );

  if (oldIndex && oldIndex.name) {
    console.log(`Dropping old global unique index: ${oldIndex.name}`);
    await collection.dropIndex(oldIndex.name);
  } else {
    console.log('No old global unique index on email found — nothing to drop.');
  }

  console.log('Creating compound unique index on { tenantId, email }...');
  await collection.createIndex({ tenantId: 1, email: 1 }, { unique: true });

  console.log('✅ Done.');
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
