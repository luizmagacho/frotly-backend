/**
 * test-driver-ops.js — Testa operações CRUD de motoristas na API.
 * Use variáveis de ambiente:
 *   BASE_URL=http://... API_EMAIL=... API_PASSWORD=... node test-driver-ops.js
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

  const dummyDriver = {
    name: 'Motorista Teste',
    cpf: '99988877700',
    phone: '41999990099',
    email: 'motorista.teste@email.com',
    licenseNumber: '99999999900',
    licenseCategory: 'B',
    licenseExpiration: '2030-12-31',
    address: 'Rua Teste, 123',
    city: 'Curitiba',
    zipCode: '80000000',
    status: 'ACTIVE'
  };

  console.log('\n1. Testing DRIVER CREATION...');
  const createRes = await fetch(`${BASE_URL}/drivers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(dummyDriver)
  });
  console.log('Response Status:', createRes.status);
  const createData = await createRes.json().catch(() => null);
  console.log('Response Body:', JSON.stringify(createData, null, 2));

  if (createRes.status !== 201) {
    console.log('Creation failed, ending test.');
    return;
  }

  const driverId = createData._id || createData.id;
  console.log(`\nCreated Driver ID: ${driverId}`);

  console.log('\n2. Testing DRIVER UPDATE...');
  const updateRes = await fetch(`${BASE_URL}/drivers/${driverId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ name: 'Motorista Teste Atualizado' })
  });
  console.log('Response Status:', updateRes.status);

  console.log('\n3. Testing DRIVER DELETION...');
  const deleteRes = await fetch(`${BASE_URL}/drivers/${driverId}`, {
    method: 'DELETE',
    headers
  });
  console.log('Response Status:', deleteRes.status);
}

run().catch(err => console.error('Error running test:', err));
