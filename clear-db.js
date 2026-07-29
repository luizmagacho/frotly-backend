/**
 * clear-db.js
 * Limpa todo o banco de dados de produção do MongoDB Atlas,
 * preservando APENAS o usuário administrador principal para que você possa logar.
 */
const { MongoClient } = require('mongodb');

const MONGO_URI = "mongodb+srv://luizmagacho94_db_user:Ly181198!@cluster0.h9qtqow.mongodb.net/gestor-frota-pr?retryWrites=true&w=majority&appName=Cluster0";
const ADMIN_EMAIL = 'magacholuiz@gmail.com';

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('✅ Conectado com sucesso ao MongoDB Atlas');
    const db = client.db();

    // Listar todas as coleções existentes no banco
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);

    console.log(`📦 Coleções encontradas no banco: ${collectionNames.join(', ')}`);
    console.log('🧹 Iniciando limpeza das coleções...');

    for (const name of collectionNames) {
      if (name === 'users') {
        // Na coleção de usuários, apagamos todos EXCETO o admin principal
        const result = await db.collection('users').deleteMany({ email: { $ne: ADMIN_EMAIL } });
        console.log(`👤 Coleção 'users': Mantido administrador '${ADMIN_EMAIL}'. Apagados outros ${result.deletedCount} usuários.`);
      } else {
        // Nas demais coleções, apagamos TODOS os registros
        const result = await db.collection(name).deleteMany({});
        console.log(`🗑️  Coleção '${name}': Apagados todos os ${result.deletedCount} registros.`);
      }
    }

    console.log('\n✨ O banco de dados de produção está 100% limpo e pronto para o cliente!');
  } catch (err) {
    console.error('❌ Erro durante a limpeza:', err.message);
  } finally {
    await client.close();
  }
}

main();
