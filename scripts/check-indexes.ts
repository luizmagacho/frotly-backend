import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DriverDocument } from '../src/drivers/schemas/driver.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const DriverModel = app.get<Model<DriverDocument>>(getModelToken('Driver'));
  
  const indexes = await DriverModel.collection.indexes();
  console.log("CURRENT INDEXES:");
  console.log(indexes.map(i => i.name));
  
  setTimeout(() => app.close(), 1000);
}
bootstrap();
