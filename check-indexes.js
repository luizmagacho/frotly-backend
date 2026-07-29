const mongoose = require('mongoose');

const ATLAS_URI = 'mongodb+srv://luizmagacho94_db_user:jUPcoN4s77wAD4co@cluster0.m57b6wj.mongodb.net/gestor-frota-pr?appName=Cluster0';

async function run() {
  console.log('Connecting to database...');
  try {
    await mongoose.connect(ATLAS_URI);
    console.log('✅ Connected');

    const db = mongoose.connection.db;
    
    // Inspect drivers collection indexes
    console.log('\n--- Drivers Collection Indexes ---');
    const drivers = db.collection('drivers');
    const driverIndexes = await drivers.indexes();
    console.log(JSON.stringify(driverIndexes, null, 2));

    // Inspect users collection indexes
    console.log('\n--- Users Collection Indexes ---');
    const users = db.collection('users');
    const userIndexes = await users.indexes();
    console.log(JSON.stringify(userIndexes, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

run();
