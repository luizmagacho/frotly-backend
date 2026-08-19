import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

async function testCreateDriver() {
  const baseURL = 'http://157.230.2.150:3001/api';
  
  try {
    // 1. Login to get token
    const loginRes = await axios.post(`${baseURL}/auth/login`, {
      email: process.env.SEED_ADMIN_EMAIL || 'admin@gestorfrota.com.br',
      password: process.env.SEED_ADMIN_PASSWORD || 'admin123'
    });
    const token = loginRes.data.accessToken;
    console.log('Got token');

    // 2. Create driver
    const payload = {
      name: "João",
      cpf: "12345678903",
      licenseNumber: "01234567893",
      licenseCategory: "B",
      licenseExpiration: "2025-10-15T00:00:00.000Z",
      phone: "41999999999",
      email: "joao3@email.com",
      status: "ACTIVE"
    };

    const res = await axios.post(`${baseURL}/drivers`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Success:', res.data);
  } catch (e: any) {
    console.error('Error:', e.response?.status);
    console.error(JSON.stringify(e.response?.data, null, 2));
  }
}
testCreateDriver();
