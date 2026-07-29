import { PartialType } from '@nestjs/mapped-types';
import { CreateInsuranceDto } from './create-insurance.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { InsuranceStatus } from '../schemas/insurance.schema';

export class UpdateInsuranceDto extends PartialType(CreateInsuranceDto) {
  @IsOptional()
  @IsEnum(InsuranceStatus)
  status?: InsuranceStatus;
}
