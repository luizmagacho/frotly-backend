import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tenant, PlanType } from '../src/tenants/schemas/tenant.schema';
import { Vehicle } from '../src/vehicles/schemas/vehicle.schema';
import { JwtService } from '@nestjs/jwt';

describe('VehiclesController (e2e) - Tenant Isolation', () => {
  let app: INestApplication;
  let tenantModel: Model<Tenant>;
  let vehicleModel: Model<Vehicle>;
  let jwtService: JwtService;

  let tenant1Id: Types.ObjectId;
  let tenant2Id: Types.ObjectId;
  let tenant1Token: string;
  let tenant2Token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    tenantModel = moduleFixture.get<Model<Tenant>>(getModelToken(Tenant.name));
    vehicleModel = moduleFixture.get<Model<Vehicle>>(getModelToken(Vehicle.name));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Create 2 distinct tenants
    const t1 = await tenantModel.create({ name: 'Tenant 1', email: 't1@example.com', document: '111', plan: PlanType.PRO } as any);
    const t2 = await tenantModel.create({ name: 'Tenant 2', email: 't2@example.com', document: '222', plan: PlanType.PRO } as any);
    tenant1Id = t1!._id as Types.ObjectId;
    tenant2Id = t2!._id as Types.ObjectId;

    // Create a vehicle for Tenant 1
    await vehicleModel.create({
      tenantId: tenant1Id,
      licensePlate: 'AAA0001',
      brand: 'Test',
      model: 'Car 1',
      year: 2020,
      modelYear: 2020,
      renavam: '111',
      chassis: '111',
    });

    // Create a vehicle for Tenant 2
    await vehicleModel.create({
      tenantId: tenant2Id,
      licensePlate: 'BBB0002',
      brand: 'Test',
      model: 'Car 2',
      year: 2021,
      modelYear: 2021,
      renavam: '222',
      chassis: '222',
    });

    // Generate tokens for both tenants
    tenant1Token = jwtService.sign({ sub: 'user1', email: 't1@example.com', tenantId: tenant1Id.toString(), role: 'ADMIN' });
    tenant2Token = jwtService.sign({ sub: 'user2', email: 't2@example.com', tenantId: tenant2Id.toString(), role: 'ADMIN' });
  });

  afterAll(async () => {
    // Cleanup
    await vehicleModel.deleteMany({ tenantId: { $in: [tenant1Id, tenant2Id] } });
    await tenantModel.deleteMany({ _id: { $in: [tenant1Id, tenant2Id] } });
    await app.close();
  });

  it('Tenant 1 should ONLY see Tenant 1 vehicles', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .expect(200);

    expect(response.body.data.length).toBe(1);
    expect(response.body.data[0].licensePlate).toBe('AAA0001');
  });

  it('Tenant 2 should ONLY see Tenant 2 vehicles', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${tenant2Token}`)
      .expect(200);

    expect(response.body.data.length).toBe(1);
    expect(response.body.data[0].licensePlate).toBe('BBB0002');
  });
});
