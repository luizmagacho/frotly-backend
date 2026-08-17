import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VehicleDocument } from '../src/vehicles/schemas/vehicle.schema';
import { tenantContext } from '../src/common/tenant.context';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const VehicleModel = app.get<Model<VehicleDocument>>(getModelToken('Vehicle'));
  
  const tenantId = '6a6a5ba90072ecfb051ccece';
  
  tenantContext.run({ tenantId }, async () => {
    const data = await VehicleModel.find({}).exec();
    console.log(`Found ${data.length} vehicles.`);
    
    // Also try countDocuments
    const count = await VehicleModel.countDocuments({});
    console.log(`Count: ${count}`);
  });
  
  setTimeout(() => app.close(), 3000);
}
bootstrap();
