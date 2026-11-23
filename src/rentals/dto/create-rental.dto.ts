import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsDate,
  IsMongoId,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { PaymentFrequency } from '../schemas/rental.schema';

export class CreateRentalDto {
  @ApiProperty({ description: 'ID do veículo' })
  @IsMongoId()
  vehicleId: string;

  @ApiProperty({ description: 'ID do motorista' })
  @IsMongoId()
  driverId: string;

  @ApiProperty({ description: 'Data de início do aluguel' })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiPropertyOptional({ description: 'Data prevista de encerramento' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expectedEndDate?: Date;

  @ApiProperty({ description: 'Valor do aluguel por período', example: 1500 })
  @IsNumber()
  @Min(0)
  rentalAmount: number;

  @ApiProperty({ description: 'Frequência de pagamento', enum: PaymentFrequency })
  @IsEnum(PaymentFrequency)
  paymentFrequency: PaymentFrequency;

  @ApiPropertyOptional({ description: 'Valor da caução (depósito de segurança)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  securityDeposit?: number;

  @ApiPropertyOptional({ description: 'Limite de rodagem por semana (km)' })
  @IsOptional()
  @IsNumber({}, { message: 'O limite semanal de km deve ser um número.' })
  @Min(0)
  weeklyKmLimit?: number;

  @ApiPropertyOptional({ description: 'Valor por km acima do limite semanal (R$/km)' })
  @IsOptional()
  @IsNumber({}, { message: 'O valor por km excedente deve ser um número.' })
  @Min(0)
  excessKmFee?: number;

  @ApiPropertyOptional({ description: 'Observações' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordPaymentDto {
  @ApiProperty({ description: 'ID do pagamento dentro do aluguel' })
  @IsString()
  paymentId: string;

  @ApiProperty({ description: 'Data de pagamento' })
  @Type(() => Date)
  @IsDate()
  paidAt: Date;

  @ApiPropertyOptional({ description: 'Método de pagamento' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Observações' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRentalDto extends PartialType(CreateRentalDto) {
  @ApiPropertyOptional({ description: 'Status do aluguel', enum: ['ACTIVE', 'OVERDUE', 'COMPLETED', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string;
}
