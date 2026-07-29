import axios from 'axios';
import * as mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/gestor-frota-pr');
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const user = await User.findOne({ email: 'contato@rogercentroautomotivo.com.br' });

  const loginRes = await axios.post('http://127.0.0.1:3001/api/auth/login', {
    email: 'contato@rogercentroautomotivo.com.br',
    password: 'Ly181198!'
  });
  const token = loginRes.data.accessToken;

  try {
    console.log('Testing /api/reports/financial');
    await axios.get('http://127.0.0.1:3001/api/reports/financial', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('OK');
  } catch (err: any) {
    console.error('Error in reports:', err.response?.data || err.message);
  }

  try {
    const Vehicle = mongoose.model('Vehicle', new mongoose.Schema({}, { strict: false }));
    const vehicle = await Vehicle.findOne();
    if (vehicle) {
      console.log(`Testing /api/financial-entries/vehicle/${vehicle._id}/ledger`);
      await axios.get(`http://127.0.0.1:3001/api/financial-entries/vehicle/${vehicle._id}/ledger`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('OK');
    }
  } catch (err: any) {
    console.error('Error in ledger:', err.response?.data || err.message);
  }

  process.exit(0);
}
run().catch(console.error);
