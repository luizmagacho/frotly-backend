import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DriverDocument } from '../src/drivers/schemas/driver.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const DriverModel = app.get<Model<DriverDocument>>(getModelToken('Driver'));
  
  // Directly query using MongoClient to see raw BSON types
  const collection = DriverModel.collection;
  const docs = await collection.find({}).toArray();
  
  console.log("RAW BSON TYPES:");
  docs.forEach(d => {
    console.log(`- ${d.name} | tenantId type: ${typeof d.tenantId} | isObjectId: ${d.tenantId instanceof Types.ObjectId}`);
  });
  
  setTimeout(() => app.close(), 1000);
}
bootstrap();
