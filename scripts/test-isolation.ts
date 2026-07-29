// @ts-nocheck
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TenantDocument } from '../src/tenants/schemas/tenant.schema';
import { VehicleDocument } from '../src/vehicles/schemas/vehicle.schema';
import { tenantContext } from '../src/common/tenant.context';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const TenantModel = app.get<Model<TenantDocument>>(getModelToken('Tenant'));
  const VehicleModel = app.get<Model<VehicleDocument>>(getModelToken('Vehicle'));

  console.log('Limpiando banco temporário para testes...');
  await TenantModel.deleteMany({});
  await VehicleModel.deleteMany({});

  console.log('Criando Locadora A e Locadora B...');
  const tenantA = await TenantModel.create({ name: 'Locadora A', cnpj: '11111111111111' });
  const tenantB = await TenantModel.create({ name: 'Locadora B', cnpj: '22222222222222' });

  console.log('Adicionando veículos aos Tenants (simulando Middleware)...');
  
  await tenantContext.run({ tenantId: tenantA._id.toString() }, async () => {
    await VehicleModel.create({
      licensePlate: 'AAA-1111',
      brand: 'Toyota',
      model: 'Corolla',
      year: 2020,
      modelYear: 2020,
      renavam: '111',
      chassis: '111',
      fuelType: 'FLEX',
      transmission: 'AUTOMATIC',
      status: 'AVAILABLE',
    });
    console.log('Veículo da Locadora A inserido com sucesso.');
  });

  await tenantContext.run({ tenantId: tenantB._id.toString() }, async () => {
    await VehicleModel.create({
      licensePlate: 'BBB-2222',
      brand: 'Honda',
      model: 'Civic',
      year: 2021,
      modelYear: 2021,
      renavam: '222',
      chassis: '222',
      fuelType: 'FLEX',
      transmission: 'AUTOMATIC',
      status: 'AVAILABLE',
    });
    console.log('Veículo da Locadora B inserido com sucesso.');
  });

  console.log('\n--- TESTE DE ISOLAMENTO (CONSULTA GLOBAL) ---');
  const allVehicles = await VehicleModel.find({});
  console.log(`Buscando SEM tenantContext ativo: Foram encontrados ${allVehicles.length} veículos.`);

  console.log('\n--- TESTE DE ISOLAMENTO (LOCADORA A) ---');
  await tenantContext.run({ tenantId: tenantA._id.toString() }, async () => {
    const vehiclesA = await VehicleModel.find({});
    console.log(`Locadora A está vendo ${vehiclesA.length} veículo(s). Placa: ${vehiclesA[0]?.licensePlate}`);
    if (vehiclesA.length !== 1 || vehiclesA[0].licensePlate !== 'AAA-1111') {
      console.error('FALHA DE ISOLAMENTO NA LOCADORA A');
    } else {
      console.log('✅ Isolamento Locadora A OK');
    }
  });

  console.log('\n--- TESTE DE ISOLAMENTO (LOCADORA B) ---');
  await tenantContext.run({ tenantId: tenantB._id.toString() }, async () => {
    const vehiclesB = await VehicleModel.find({});
    console.log(`Locadora B está vendo ${vehiclesB.length} veículo(s). Placa: ${vehiclesB[0]?.licensePlate}`);
    if (vehiclesB.length !== 1 || vehiclesB[0].licensePlate !== 'BBB-2222') {
      console.error('FALHA DE ISOLAMENTO NA LOCADORA B');
    } else {
      console.log('✅ Isolamento Locadora B OK');
    }
  });

  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
