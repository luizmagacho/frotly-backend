import { IsDateString, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateMileageDto {
  @IsMongoId()
  vehicleId: string;

  @IsDateString()
  date: string;

  @IsNumber()
  @Min(0)
  mileage: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
