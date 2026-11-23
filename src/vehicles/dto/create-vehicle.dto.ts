import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsDate,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FuelType, TransmissionType } from '../schemas/vehicle.schema';

export class CreateVehicleDto {
  @ApiPropertyOptional({ description: 'Placa do veículo (nomenclatura interna)', example: 'ABC1D23' })
  @IsOptional()
  @IsString({ message: 'A placa deve ser um texto.' })
  @MinLength(7, { message: 'A placa deve ter no mínimo 7 caracteres.' })
  @MaxLength(8, { message: 'A placa deve ter no máximo 8 caracteres.' })
  licensePlate?: string;

  @ApiPropertyOptional({ description: 'Placa do veículo (nomenclatura do frontend)', example: 'ABC1D23' })
  @IsOptional()
  @IsString({ message: 'A placa deve ser um texto.' })
  @MinLength(7, { message: 'A placa deve ter no mínimo 7 caracteres.' })
  @MaxLength(8, { message: 'A placa deve ter no máximo 8 caracteres.' })
  plate?: string;

  @ApiProperty({ description: 'Marca', example: 'Toyota' })
  @IsString({ message: 'A marca deve ser um texto.' })
  brand: string;

  @ApiProperty({ description: 'Modelo', example: 'Corolla' })
  @IsString({ message: 'O modelo deve ser um texto.' })
  model: string;

  @ApiProperty({ description: 'Ano de fabricação', example: 2022 })
  @IsNumber({}, { message: 'O ano de fabricação deve ser um número.' })
  @Min(1990, { message: 'O ano de fabricação deve ser maior ou igual a 1990.' })
  year: number;

  @ApiProperty({ description: 'Ano do modelo', example: 2023 })
  @IsNumber({}, { message: 'O ano do modelo deve ser um número.' })
  modelYear: number;

  @ApiPropertyOptional({ description: 'Cor', example: 'Branco' })
  @IsOptional()
  @IsString({ message: 'A cor deve ser um texto.' })
  color?: string;

  @ApiProperty({ description: 'RENAVAM (11 dígitos)', example: '12345678901' })
  @IsString({ message: 'O RENAVAM deve ser um texto.' })
  @MinLength(9, { message: 'O RENAVAM deve ter no mínimo 9 dígitos.' })
  @MaxLength(11, { message: 'O RENAVAM deve ter no máximo 11 dígitos.' })
  renavam: string;

  @ApiProperty({ description: 'Chassi (17 caracteres)', example: '9BWZZZ377VT004251' })
  @IsString({ message: 'O chassi deve ser um texto.' })
  @MinLength(17, { message: 'O chassi deve ter exatamente 17 caracteres.' })
  @MaxLength(17, { message: 'O chassi deve ter exatamente 17 caracteres.' })
  chassis: string;

  @ApiPropertyOptional({ enum: FuelType, description: 'Tipo de combustível' })
  @IsOptional()
  @IsEnum(FuelType, { message: 'O tipo de combustível selecionado é inválido.' })
  fuelType?: FuelType;

  @ApiPropertyOptional({ enum: TransmissionType, description: 'Tipo de câmbio' })
  @IsOptional()
  @IsEnum(TransmissionType, { message: 'O tipo de câmbio selecionado é inválido.' })
  transmission?: TransmissionType;

  @ApiPropertyOptional({ description: 'Quilometragem atual' })
  @IsOptional()
  @IsNumber({}, { message: 'A quilometragem deve ser um número.' })
  mileage?: number;

  @ApiPropertyOptional({ description: 'Data de vencimento do IPVA' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'A data de vencimento do IPVA é inválida.' })
  ipvaDueDate?: Date;

  @ApiPropertyOptional({ description: 'Data de vencimento do licenciamento' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'A data de vencimento do licenciamento é inválida.' })
  licensingDueDate?: Date;

  @ApiPropertyOptional({ description: 'Data de vencimento do seguro' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'A data de vencimento do seguro é inválida.' })
  insuranceExpiration?: Date;

  @ApiPropertyOptional({ description: 'Valor de compra' })
  @IsOptional()
  @IsNumber({}, { message: 'O valor de compra deve ser um número.' })
  purchaseValue?: number;

  @ApiPropertyOptional({ description: 'Valor de compra (nomenclatura do frontend)' })
  @IsOptional()
  @IsNumber({}, { message: 'O valor de compra deve ser um número.' })
  purchasePrice?: number;

  @ApiPropertyOptional({ description: 'Quantidade de assentos/lugares', example: 5 })
  @IsOptional()
  @IsNumber({}, { message: 'A quantidade de assentos deve ser um número.' })
  seats?: number;

  @ApiPropertyOptional({ description: 'Observações' })
  @IsOptional()
  @IsString({ message: 'As observações devem ser um texto.' })
  notes?: string;

  @ApiPropertyOptional({ description: 'Código FIPE da versão', example: '014115-1' })
  @IsOptional()
  @IsString()
  fipeCode?: string;

  @ApiPropertyOptional({ description: 'Ano-modelo/combustível na FIPE', example: '2024-5' })
  @IsOptional()
  @IsString()
  fipeYearCode?: string;

  @ApiPropertyOptional({ description: 'Nome da versão na FIPE' })
  @IsOptional()
  @IsString()
  fipeModelName?: string;
}
