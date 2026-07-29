import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillingService } from './billing.service';
import { TrialService } from './trial.service';
import { CancellationService } from './cancellation.service';
import { BillingController } from './billing.controller';
import { Tenant, TenantSchema } from '../tenants/schemas/tenant.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Tenant.name, schema: TenantSchema }])],
  controllers: [BillingController],
  providers: [BillingService, TrialService, CancellationService],
  exports: [TrialService],
})
export class BillingModule {}
