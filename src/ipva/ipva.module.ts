import { Module } from '@nestjs/common';
import { IpvaService } from './ipva.service';
import { IpvaController } from './ipva.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Ipva, IpvaSchema } from './schemas/ipva.schema';
import { FinancialEntriesModule } from '../financial-entries/financial-entries.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ipva.name, schema: IpvaSchema }]),
    FinancialEntriesModule,
  ],
  controllers: [IpvaController],
  providers: [IpvaService],
  exports: [IpvaService],
})
export class IpvaModule {}
