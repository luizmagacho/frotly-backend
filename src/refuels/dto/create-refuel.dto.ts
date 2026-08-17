import { IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FuelType } from '../schemas/refuel.schema';

export class CreateRefuelDto {
  @IsMongoId()
  vehicleId: string;

  @IsOptional()
  @IsMongoId()
  driverId?: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  stationName?: string;

  @IsEnum(FuelType)
  fuelType: FuelType;

  @IsNumber()
  @Min(0)
  volume: number;

  @IsNumber()
  @Min(0)
  pricePerUnit: number;

  @IsNumber()
  @Min(0)
  totalCost: number;

  @IsNumber()
  @Min(0)
  currentMileage: number;

  @IsOptional()
  isFullTank?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
