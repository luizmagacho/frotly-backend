import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DriverDocument } from '../src/drivers/schemas/driver.schema';
import { VehicleDocument } from '../src/vehicles/schemas/vehicle.schema';
import { CustomerDocument } from '../src/customers/schemas/customer.schema';
import { UserDocument } from '../src/auth/schemas/user.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const DriverModel = app.get<Model<DriverDocument>>(getModelToken('Driver'));
  const VehicleModel = app.get<Model<VehicleDocument>>(getModelToken('Vehicle'));
  const CustomerModel = app.get<Model<CustomerDocument>>(getModelToken('Customer'));
  const UserModel = app.get<Model<UserDocument>>(getModelToken('User'));

  const models = [
    { name: 'Driver', model: DriverModel, oldIndexes: ['cpf_1', 'licenseNumber_1'] },
    { name: 'Vehicle', model: VehicleModel, oldIndexes: ['plate_1', 'chassis_1', 'renavam_1'] },
    { name: 'Customer', model: CustomerModel, oldIndexes: ['document_1'] },
    { name: 'User', model: UserModel, oldIndexes: ['email_1'] }
  ];

  for (const { name, model, oldIndexes } of models) {
    try {
      const indexes = await model.collection.indexes();
      const indexNames = indexes.map(i => i.name);
      console.log(`Indexes for ${name}:`, indexNames);
      
      for (const idx of oldIndexes) {
        if (indexNames.includes(idx)) {
          console.log(`Dropping old index ${idx} from ${name}...`);
          await model.collection.dropIndex(idx);
          console.log(`Successfully dropped ${idx} from ${name}`);
        }
      }
      
      // Also force Mongoose to sync the correct indexes based on current schema
      await model.syncIndexes();
      console.log(`Synced indexes for ${name} based on current schema`);
    } catch (e) {
      console.log(`Error processing ${name}: ${e.message}`);
    }
  }
  
  setTimeout(() => app.close(), 1000);
}
bootstrap();
