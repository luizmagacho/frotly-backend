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

  const dummyDriver = {
    name: 'Motorista Teste Prod',
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
    body: JSON.stringify({ name: 'Motorista Teste Prod Atualizado' })
  });
  console.log('Response Status:', updateRes.status);
  const updateData = await updateRes.json().catch(() => null);
  console.log('Response Body:', JSON.stringify(updateData, null, 2));

  console.log('\n3. Testing DRIVER DELETION...');
  const deleteRes = await fetch(`${BASE_URL}/drivers/${driverId}`, {
    method: 'DELETE',
    headers
  });
  console.log('Response Status:', deleteRes.status);
  const deleteText = await deleteRes.text();
  console.log('Response Body:', deleteText);
}

run().catch(err => console.error('Error running test:', err));
