import { Module } from '@nestjs/common';
import { DetranController } from './detran.controller';
import { DetranService } from './detran.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [DetranController],
  providers: [DetranService],
  exports: [DetranService],
})
export class DetranModule {}
