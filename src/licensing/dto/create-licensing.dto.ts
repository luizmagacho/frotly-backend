import { IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, Min } from 'class-validator';
import { LicensingStatus } from '../schemas/licensing.schema';

export class CreateLicensingDto {
  @IsMongoId()
  vehicleId: string;

  @IsNumber()
  year: number;

  @IsNumber()
  @Min(0)
  value: number;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsEnum(LicensingStatus)
  status?: LicensingStatus;
}
