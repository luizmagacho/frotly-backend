import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DriverDocument } from '../src/drivers/schemas/driver.schema';
import { VehicleDocument } from '../src/vehicles/schemas/vehicle.schema';
import { CustomerDocument } from '../src/customers/schemas/customer.schema';
import { UserDocument } from '../src/auth/schemas/user.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const models = [
    app.get<Model<DriverDocument>>(getModelToken('Driver')),
    app.get<Model<VehicleDocument>>(getModelToken('Vehicle')),
    app.get<Model<CustomerDocument>>(getModelToken('Customer')),
    app.get<Model<UserDocument>>(getModelToken('User')),
  ];

  for (const model of models) {
    const collection = model.collection;
    console.log(`Fixing string tenantIds in ${collection.collectionName}...`);
    
    const docs = await collection.find({ tenantId: { $type: 'string' } }).toArray();
    for (const doc of docs) {
      if (typeof doc.tenantId === 'string' && Types.ObjectId.isValid(doc.tenantId)) {
        await collection.updateOne(
          { _id: doc._id },
          { $set: { tenantId: new Types.ObjectId(doc.tenantId) } }
        );
        console.log(`- Fixed tenantId for doc ${doc._id}`);
      }
    }
  }
  
  console.log('Done!');
  setTimeout(() => app.close(), 1000);
}
bootstrap();
