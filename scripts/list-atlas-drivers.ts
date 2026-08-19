import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DriverDocument } from '../src/drivers/schemas/driver.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const DriverModel = app.get<Model<DriverDocument>>(getModelToken('Driver'));
  
  const allDrivers = await DriverModel.find({}).exec();
  console.log("ALL DRIVERS IN ATLAS:");
  allDrivers.forEach(d => {
    console.log(`- ${d.name} | CPF: ${d.cpf} | CNH: ${d.licenseNumber} | Tenant: ${d.tenantId} | Status: ${d.status}`);
  });
  
  setTimeout(() => app.close(), 1000);
}
bootstrap();
