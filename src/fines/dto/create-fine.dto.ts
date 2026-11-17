import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { DriverChargeStatus, FineStatus } from '../schemas/fine.schema';

export class CreateFineDto {
  @ApiProperty()
  @IsMongoId({ message: 'Veículo inválido.' })
  vehicleId: string;

  @ApiPropertyOptional({ description: 'Se omitido, o sistema usa o motorista que estava com o carro na data da infração.' })
  @IsOptional()
  @IsMongoId({ message: 'Motorista inválido.' })
  driverId?: string;

  @ApiProperty({ description: 'Número do auto de infração (AIT)' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o número do auto de infração.' })
  noticeNumber: string;

  @ApiProperty()
  @IsDateString({}, { message: 'Data da infração inválida.' })
  infractionDate: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Descreva a infração.' })
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  infractionCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  issuingAgency?: string;

  @ApiProperty()
  @IsNumber({}, { message: 'Valor inválido.' })
  @Min(0)
  value: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  points?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'Data de vencimento inválida.' })
  dueDate?: string;

  @ApiPropertyOptional({ enum: FineStatus })
  @IsOptional()
  @IsEnum(FineStatus)
  status?: FineStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  driverIndicated?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  chargeToDriver?: boolean;

  @ApiPropertyOptional({ enum: DriverChargeStatus })
  @IsOptional()
  @IsEnum(DriverChargeStatus)
  driverChargeStatus?: DriverChargeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
