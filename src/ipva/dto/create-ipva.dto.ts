import { IsArray, IsEnum, IsMongoId, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IpvaStatus } from '../schemas/ipva.schema';

export class IpvaInstallmentDto {
  @IsNumber()
  installmentNumber: number;

  @IsNumber()
  amount: number;

  @IsOptional()
  dueDate: string; // ISO date

  @IsEnum(IpvaStatus)
  status: IpvaStatus;
}

export class CreateIpvaDto {
  @IsMongoId()
  vehicleId: string;

  @IsNumber()
  year: number;

  @IsNumber()
  totalAmount: number;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsEnum(IpvaStatus)
  status: IpvaStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IpvaInstallmentDto)
  installments: IpvaInstallmentDto[];
}
