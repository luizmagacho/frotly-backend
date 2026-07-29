import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { PlanGuard } from './guards/plan.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tenant.name, schema: TenantSchema }]),
    AuthModule,
    BillingModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService, PlanGuard],
  // Re-exporting MongooseModule (not just PlanGuard) matters: module encapsulation
  // means importing modules only see what's in `exports`, not transitively what
  // TenantsModule itself imports — without this, PlanGuard's own @InjectModel(Tenant)
  // dependency can't resolve in whatever module consumes PlanGuard.
  exports: [TenantsService, PlanGuard, MongooseModule],
})
export class TenantsModule {}
