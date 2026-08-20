/**
 * clear-db.js — Limpa o banco de dados (apenas em dev/staging).
 * NUNCA hardcode credenciais aqui. Use variáveis de ambiente:
 *   MONGODB_URI=<uri> ADMIN_EMAIL=<email> node clear-db.js
 */
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

if (!MONGO_URI || !ADMIN_EMAIL) {
  console.error('❌ Defina MONGODB_URI e ADMIN_EMAIL como variáveis de ambiente antes de executar.');
  console.error('   Exemplo: MONGODB_URI=mongodb+srv://... ADMIN_EMAIL=admin@email.com node clear-db.js');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('✅ Conectado com sucesso ao MongoDB Atlas');
    const db = client.db();

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);

    console.log(`📦 Coleções encontradas no banco: ${collectionNames.join(', ')}`);
    console.log('🧹 Iniciando limpeza das coleções...');

    for (const name of collectionNames) {
      if (name === 'users') {
        const result = await db.collection('users').deleteMany({ email: { $ne: ADMIN_EMAIL } });
        console.log(`👤 Coleção 'users': Mantido administrador '${ADMIN_EMAIL}'. Apagados outros ${result.deletedCount} usuários.`);
      } else {
        const result = await db.collection(name).deleteMany({});
        console.log(`🗑️  Coleção '${name}': Apagados todos os ${result.deletedCount} registros.`);
      }
    }

    console.log('\n✨ O banco de dados está limpo!');
  } catch (err) {
    console.error('❌ Erro durante a limpeza:', err.message);
  } finally {
    await client.close();
  }
}

main();
