import { IsDateString, IsEnum, IsInt, IsMongoId, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { LicensingStatus } from '../schemas/licensing.schema';

export class CreateLicensingDto {
  @IsMongoId({ message: 'Veículo inválido.' })
  vehicleId: string;

  @IsInt({ message: 'Ano inválido.' })
  @Min(2000, { message: 'Ano inválido.' })
  @Max(2100, { message: 'Ano inválido.' })
  year: number;

  @IsNumber({}, { message: 'Valor inválido.' })
  @Min(0, { message: 'O valor não pode ser negativo.' })
  value: number;

  @IsDateString({}, { message: 'Data de vencimento inválida.' })
  dueDate: string;

  @IsOptional()
  @IsEnum(LicensingStatus, { message: 'Situação inválida.' })
  status?: LicensingStatus;
}
