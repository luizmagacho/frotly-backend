import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DriverDocument } from '../src/drivers/schemas/driver.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const DriverModel = app.get<Model<DriverDocument>>(getModelToken('Driver'));
  
  const allDrivers = await DriverModel.find({}).exec();
  console.log("ALL DRIVERS IN DB:");
  console.log(allDrivers.map(d => ({ name: d.name, cpf: d.cpf, cnh: d.licenseNumber })));
  
  setTimeout(() => app.close(), 1000);
}
bootstrap();
