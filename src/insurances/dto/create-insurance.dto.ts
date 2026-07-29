import { IsString, IsNumber, IsOptional, IsDate, IsMongoId, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInsuranceDto {
  @IsMongoId()
  vehicleId: string;

  @IsOptional()
  @IsString()
  policyNumber?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  brokerName?: string;

  @IsOptional()
  @IsString()
  brokerPhone?: string;

  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @IsNumber()
  @Min(0)
  cost: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  franchiseAmount?: number;

  @IsOptional()
  @IsString()
  coverageType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number;
}
