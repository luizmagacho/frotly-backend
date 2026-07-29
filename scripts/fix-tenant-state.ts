import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantDocument } from '../src/tenants/schemas/tenant.schema';
import { UserDocument } from '../src/auth/schemas/user.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const TenantModel = app.get<Model<TenantDocument>>(getModelToken('Tenant'));
  const UserModel = app.get<Model<UserDocument>>(getModelToken('User'));

  // Create a default tenant
  let defaultTenant = await TenantModel.findOne({ name: 'Locadora Padrão' });
  if (!defaultTenant) {
    defaultTenant = await TenantModel.create({ name: 'Locadora Padrão', cnpj: '00000000000000' });
    console.log('Created default tenant.');
  }

  // Update all users to belong to the default tenant if they don't have one
  const result = await UserModel.updateMany(
    { tenantId: { $exists: false } },
    { $set: { tenantId: defaultTenant._id } }
  );
  console.log(`Updated ${result.modifiedCount} users with the default tenantId.`);

  await app.close();
}

bootstrap().catch(console.error);
