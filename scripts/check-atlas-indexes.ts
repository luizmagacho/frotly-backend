import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DriverDocument } from '../src/drivers/schemas/driver.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const DriverModel = app.get<Model<DriverDocument>>(getModelToken('Driver'));
  
  // Directly get indexes from the raw collection just to be 100% sure
  const rawIndexes = await DriverModel.collection.indexes();
  console.log("RAW INDEXES:");
  rawIndexes.forEach(idx => console.log(idx.name));
  
  setTimeout(() => app.close(), 1000);
}
bootstrap();
