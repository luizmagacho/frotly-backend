import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DetranController } from './detran.controller';
import { DetranService } from './detran.service';
import { TenantsModule } from '../tenants/tenants.module';
import { Vehicle, VehicleSchema } from '../vehicles/schemas/vehicle.schema';
import { Tenant, TenantSchema } from '../tenants/schemas/tenant.schema';
import { Fine, FineSchema } from '../fines/schemas/fine.schema';
import { Licensing, LicensingSchema } from '../licensing/schemas/licensing.schema';
import { Ipva, IpvaSchema } from '../ipva/schemas/ipva.schema';
import { FinesModule } from '../fines/fines.module';
import { LicensingModule } from '../licensing/licensing.module';
import { FinancialEntriesModule } from '../financial-entries/financial-entries.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DetranQuery, DetranQuerySchema } from './schemas/detran-query.schema';
import { InfosimplesClient } from './providers/infosimples.client';
import { RjDetranProvider } from './providers/rj.provider';
import { DetranSyncService } from './detran-sync.service';
import { DetranSyncController } from './detran-sync.controller';

/**
 * DetranService/DetranController: consulta avulsa ao Detran-PR (API frotista, Enterprise).
 * DetranSyncService/DetranSyncController: consulta automática por UF via Infosimples (RJ),
 * que grava multas, licenciamento e IPVA.
 */
@Module({
  imports: [
    TenantsModule,
    MongooseModule.forFeature([
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Fine.name, schema: FineSchema },
      { name: Licensing.name, schema: LicensingSchema },
      { name: Ipva.name, schema: IpvaSchema },
      { name: DetranQuery.name, schema: DetranQuerySchema },
    ]),
    FinesModule,
    LicensingModule,
    FinancialEntriesModule,
    NotificationsModule,
  ],
  controllers: [DetranSyncController, DetranController],
  providers: [DetranService, InfosimplesClient, RjDetranProvider, DetranSyncService],
  exports: [DetranService, DetranSyncService],
})
export class DetranModule {}
