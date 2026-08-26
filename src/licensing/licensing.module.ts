import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LicensingService } from './licensing.service';
import { LicensingController } from './licensing.controller';
import { Licensing, LicensingSchema } from './schemas/licensing.schema';
import { FinancialEntriesModule } from '../financial-entries/financial-entries.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Licensing.name, schema: LicensingSchema }]),
    FinancialEntriesModule,
  ],
  controllers: [LicensingController],
  providers: [LicensingService],
  exports: [LicensingService],
})
export class LicensingModule {}
