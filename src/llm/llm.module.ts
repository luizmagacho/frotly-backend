import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  providers: [LlmService],
  exports: [LlmService],
  controllers: [LlmController],
})
export class LlmModule {}
