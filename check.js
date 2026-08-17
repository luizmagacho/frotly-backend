const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/gestor-frota-pr')
  .then(async () => {
    const db = mongoose.connection.db;
    const cars = await db.collection('vehicles').find({}).toArray();
    console.log('Total cars:', cars.length);
    console.log('All plates:', cars.map(c => c.licensePlate || c.plate).join(', '));
    process.exit(0);
  });
