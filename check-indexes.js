/**
 * check-indexes.js — Verifica os índices do MongoDB Atlas.
 * NUNCA hardcode credenciais aqui. Use variáveis de ambiente:
 *   MONGODB_URI=<uri> node check-indexes.js
 */
const { MongoClient } = require('mongodb');

const ATLAS_URI = process.env.MONGODB_URI;

if (!ATLAS_URI) {
  console.error('❌ Defina MONGODB_URI como variável de ambiente antes de executar.');
  console.error('   Exemplo: MONGODB_URI=mongodb+srv://... node check-indexes.js');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(ATLAS_URI);
  try {
    await client.connect();
    const db = client.db();

    const collections = ['drivers', 'vehicles', 'users', 'customers'];
    for (const col of collections) {
      const indexes = await db.collection(col).indexes();
      console.log(`\n📋 Índices de '${col}':`);
      indexes.forEach(idx => console.log(' -', JSON.stringify(idx.key), idx.unique ? '[UNIQUE]' : ''));
    }
  } finally {
    await client.close();
  }
}

main().catch(err => console.error('Erro:', err.message));
