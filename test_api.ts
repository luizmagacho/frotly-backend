/**
 * test_api.ts — Testa endpoints da API localmente.
 * Use variáveis de ambiente:
 *   MONGODB_URI=... API_EMAIL=... API_PASSWORD=... npx ts-node test_api.ts
 */
import axios from 'axios';
import * as mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gestor-frota-pr';
const API_EMAIL = process.env.API_EMAIL;
const API_PASSWORD = process.env.API_PASSWORD;
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001/api';

if (!API_EMAIL || !API_PASSWORD) {
  console.error('❌ Defina API_EMAIL e API_PASSWORD como variáveis de ambiente.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI);

  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: API_EMAIL,
    password: API_PASSWORD
  });
  const token = loginRes.data.accessToken;

  try {
    console.log('Testing /api/reports/financial');
    await axios.get(`${BASE_URL}/reports/financial`, {
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
      await axios.get(`${BASE_URL}/financial-entries/vehicle/${vehicle._id}/ledger`, {
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
