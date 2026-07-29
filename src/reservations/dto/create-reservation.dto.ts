import { IsString, IsEnum, IsOptional, IsDate, IsNumber, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '../schemas/reservation.schema';

export class CreateReservationDto {
  @ApiProperty({ description: 'ID do cliente' })
  @IsMongoId({ message: 'ID de cliente inválido.' })
  customerId: string;

  @ApiPropertyOptional({ description: 'ID do veículo' })
  @IsOptional()
  @IsMongoId({ message: 'ID de veículo inválido.' })
  vehicleId?: string;

  @ApiProperty({ description: 'Data de início' })
  @Type(() => Date)
  @IsDate({ message: 'A data de início deve ser válida.' })
  startDate: Date;

  @ApiProperty({ description: 'Data de fim' })
  @Type(() => Date)
  @IsDate({ message: 'A data de fim deve ser válida.' })
  endDate: Date;

  @ApiPropertyOptional({ description: 'Valor estimado' })
  @IsOptional()
  @IsNumber({}, { message: 'O valor estimado deve ser um número.' })
  estimatedAmount?: number;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;
}
