import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantDocument } from '../src/tenants/schemas/tenant.schema';
import { UserDocument } from '../src/auth/schemas/user.schema';
import { VehicleDocument } from '../src/vehicles/schemas/vehicle.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const TenantModel = app.get<Model<TenantDocument>>(getModelToken('Tenant'));
  const UserModel = app.get<Model<UserDocument>>(getModelToken('User'));
  const VehicleModel = app.get<Model<VehicleDocument>>(getModelToken('Vehicle'));

  const tenants = await TenantModel.find({});
  console.log('Tenants:', tenants.map(t => ({ id: t._id, name: t.name })));

  const users = await UserModel.find({}, { email: 1, name: 1, tenantId: 1 });
  console.log('Users:', users);

  const vehicleCounts = await Promise.all(tenants.map(async t => {
    const count = await VehicleModel.countDocuments({ tenantId: t._id });
    return { name: t.name, vehicles: count };
  }));
  console.log('Vehicle counts by tenant:', vehicleCounts);

  await app.close();
}
bootstrap();
