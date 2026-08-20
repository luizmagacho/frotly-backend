/**
 * test-driver-errors.js — Testa respostas de erro da API para motoristas.
 * Use variáveis de ambiente:
 *   BASE_URL=http://... API_EMAIL=... API_PASSWORD=... node test-driver-errors.js
 */
const fetch = globalThis.fetch || require('node-fetch');

const BASE_URL = process.env.BASE_URL;
const API_EMAIL = process.env.API_EMAIL;
const API_PASSWORD = process.env.API_PASSWORD;

if (!BASE_URL || !API_EMAIL || !API_PASSWORD) {
  console.error('❌ Defina BASE_URL, API_EMAIL e API_PASSWORD como variáveis de ambiente.');
  process.exit(1);
}

async function run() {
  console.log('Logging in...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: API_EMAIL, password: API_PASSWORD })
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

  const firstDriver = {
    name: 'Motorista Duplicado 1',
    cpf: '11122233344',
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
