import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsNumber,
  IsMongoId,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InspectionType, FuelLevel } from '../schemas/inspection.schema';

export class DamageItemDto {
  @ApiPropertyOptional({ description: 'Local do dano no veículo' })
  @IsOptional()
  @IsString({ message: 'O local do dano deve ser um texto.' })
  location?: string;

  @ApiPropertyOptional({ description: 'Descrição do dano' })
  @IsOptional()
  @IsString({ message: 'A descrição do dano deve ser um texto.' })
  description?: string;

  @ApiPropertyOptional({ description: 'URL da foto do dano' })
  @IsOptional()
  @IsString({ message: 'A URL da foto deve ser um texto.' })
  photoUrl?: string;
}

export class CreateInspectionDto {
  @ApiProperty({ description: 'ID do contrato de locação (Rental)', example: '665f1a2b3c4d5e6f7a8b9c0d' })
  @IsMongoId({ message: 'O rentalId deve ser um ID MongoDB válido.' })
  rentalId: string;

  @ApiProperty({ description: 'ID do veículo', example: '665f1a2b3c4d5e6f7a8b9c0e' })
  @IsMongoId({ message: 'O vehicleId deve ser um ID MongoDB válido.' })
  vehicleId: string;

  @ApiProperty({ description: 'ID do motorista', example: '665f1a2b3c4d5e6f7a8b9c0f' })
  @IsMongoId({ message: 'O driverId deve ser um ID MongoDB válido.' })
  driverId: string;

  @ApiProperty({ description: 'Tipo da vistoria', enum: InspectionType })
  @IsEnum(InspectionType, { message: 'O tipo de vistoria selecionado é inválido.' })
  type: InspectionType;

  @ApiPropertyOptional({ description: 'Quilometragem atual do veículo', example: 45320 })
  @IsOptional()
  @IsNumber({}, { message: 'A quilometragem deve ser um número.' })
  @Min(0, { message: 'A quilometragem não pode ser negativa.' })
  mileage?: number;

  @ApiPropertyOptional({ description: 'Nível de combustível', enum: FuelLevel })
  @IsOptional()
  @IsEnum(FuelLevel, { message: 'O nível de combustível selecionado é inválido.' })
  fuelLevel?: FuelLevel;

  @ApiPropertyOptional({ description: 'URLs das fotos da vistoria', type: [String] })
  @IsOptional()
  @IsArray({ message: 'As fotos devem ser uma lista.' })
  @IsString({ each: true, message: 'Cada foto deve ser uma URL em formato de texto.' })
  photos?: string[];

  @ApiPropertyOptional({ description: 'Lista de danos identificados', type: [DamageItemDto] })
  @IsOptional()
  @IsArray({ message: 'Os danos devem ser uma lista.' })
  @ValidateNested({ each: true })
  @Type(() => DamageItemDto)
  damages?: DamageItemDto[];

  @ApiPropertyOptional({ description: 'Observações gerais da vistoria' })
  @IsOptional()
  @IsString({ message: 'As observações devem ser um texto.' })
  observations?: string;

  @ApiPropertyOptional({ description: 'Nome do vistoriador' })
  @IsOptional()
  @IsString({ message: 'O nome do vistoriador deve ser um texto.' })
  inspectorName?: string;

  @ApiPropertyOptional({ description: 'Assinatura digital (base64 ou URL)' })
  @IsOptional()
  @IsString({ message: 'A assinatura deve ser um texto.' })
  signature?: string;
}
