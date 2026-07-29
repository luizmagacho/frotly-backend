import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelSubscriptionDto {
  @ApiProperty({ description: 'Motivo do cancelamento (opcional)', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
