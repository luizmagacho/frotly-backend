import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantDocument, PlanType } from '../src/tenants/schemas/tenant.schema';
import { UserDocument } from '../src/auth/schemas/user.schema';
import { VehicleDocument } from '../src/vehicles/schemas/vehicle.schema';
import { CustomerDocument } from '../src/customers/schemas/customer.schema';
import { DriverDocument } from '../src/drivers/schemas/driver.schema';
import { MaintenanceDocument } from '../src/maintenances/schemas/maintenance.schema';
import { RentalDocument } from '../src/rentals/schemas/rental.schema';
import { ReservationDocument } from '../src/reservations/schemas/reservation.schema';
import { FinancialEntryDocument } from '../src/financial-entries/schemas/financial-entry.schema';
import { InspectionDocument } from '../src/inspections/schemas/inspection.schema';
import { HistoryEventDocument } from '../src/history/schemas/history-event.schema';
import { IpvaDocument } from '../src/ipva/schemas/ipva.schema';
import { RefuelDocument } from '../src/refuels/schemas/refuel.schema';
import { InsuranceDocument } from '../src/insurances/schemas/insurance.schema';

async function bootstrap() {
  console.log('Connecting to database...');
  // Initialize the app context (this will connect to the DB using process.env.MONGODB_URI)
  const app = await NestFactory.createApplicationContext(AppModule);
  
  console.log('Successfully connected! Fetching models...');
  
  const TenantModel = app.get<Model<TenantDocument>>(getModelToken('Tenant'));
  const UserModel = app.get<Model<UserDocument>>(getModelToken('User'));
  
  // Safe extraction of other models in case they are not in this older DB yet
  const modelsToMigrate: { name: string; getModel: () => Model<any> }[] = [
    { name: 'Vehicle', getModel: () => app.get<Model<VehicleDocument>>(getModelToken('Vehicle')) },
    { name: 'Customer', getModel: () => app.get<Model<CustomerDocument>>(getModelToken('Customer')) },
    { name: 'Driver', getModel: () => app.get<Model<DriverDocument>>(getModelToken('Driver')) },
    { name: 'Maintenance', getModel: () => app.get<Model<MaintenanceDocument>>(getModelToken('Maintenance')) },
    { name: 'Rental', getModel: () => app.get<Model<RentalDocument>>(getModelToken('Rental')) },
    { name: 'Reservation', getModel: () => app.get<Model<ReservationDocument>>(getModelToken('Reservation')) },
    { name: 'FinancialEntry', getModel: () => app.get<Model<FinancialEntryDocument>>(getModelToken('FinancialEntry')) },
    { name: 'Inspection', getModel: () => app.get<Model<InspectionDocument>>(getModelToken('Inspection')) },
    { name: 'HistoryEvent', getModel: () => app.get<Model<HistoryEventDocument>>(getModelToken('HistoryEvent')) },
    { name: 'Ipva', getModel: () => app.get<Model<IpvaDocument>>(getModelToken('Ipva')) },
    { name: 'Refuel', getModel: () => app.get<Model<RefuelDocument>>(getModelToken('Refuel')) },
    { name: 'Insurance', getModel: () => app.get<Model<InsuranceDocument>>(getModelToken('Insurance')) }
  ];

  // 1. Create default tenant
  let defaultTenant = await TenantModel.findOne({ name: 'Locadora Magacho' });
  if (!defaultTenant) {
    defaultTenant = await TenantModel.create({ 
      name: 'Locadora Magacho', 
      cnpj: '00000000000000',
      isActive: true,
      plan: PlanType.ENTERPRISE,
      trialEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 10)) 
    });
    console.log('✅ Created default tenant: Locadora Magacho');
  } else {
    console.log('ℹ️ Default tenant already exists.');
  }

  // 2. Migrate Users
  const userResult = await UserModel.updateMany(
    { tenantId: { $exists: false } },
    { $set: { tenantId: defaultTenant._id } }
  );
  console.log(`✅ Updated ${userResult.modifiedCount} users with the default tenantId.`);

  // 3. Migrate other collections
  for (const modelInfo of modelsToMigrate) {
    try {
      const model = modelInfo.getModel();
      if (model) {
        const result = await model.updateMany(
          { tenantId: { $exists: false } },
          { $set: { tenantId: defaultTenant._id } }
        );
        console.log(`✅ Updated ${result.modifiedCount} records in ${modelInfo.name}.`);
      }
    } catch (e) {
      console.log(`⚠️ Skipped ${modelInfo.name} (possibly not loaded or no records yet).`);
    }
  }

  console.log('🎉 Migration completed successfully!');
  await app.close();
}

bootstrap().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
