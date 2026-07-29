const fetch = require('node-fetch') || globalThis.fetch;

const BASE_URL = 'http://157.230.2.150:3001/api';

async function run() {
  console.log('Logging in...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'magacholuiz@gmail.com', password: 'Ly181198!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  if (!token) {
    console.error('Login failed:', loginData);
    return;
  }
  console.log('✅ Logged in successfully.');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Test duplicate CPF
  const firstDriver = {
    name: 'Motorista Duplicado 1',
    cpf: '11122233344', // CPF that is likely already in production db
    phone: '41999990001',
    email: 'dup1@email.com',
    licenseNumber: '11111111101',
    licenseCategory: 'B',
    licenseExpiration: '2030-12-31',
    status: 'ACTIVE'
  };

  console.log('\nTesting DUPLICATE DRIVER CREATION...');
  const res = await fetch(`${BASE_URL}/drivers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(firstDriver)
  });
  console.log('Response Status:', res.status);
  const data = await res.json().catch(() => null);
  console.log('Response Body:', JSON.stringify(data, null, 2));
}

run().catch(err => console.error('Error running test:', err));
