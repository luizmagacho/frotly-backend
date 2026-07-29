import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlanType } from '../../tenants/schemas/tenant.schema';

export class CreateCheckoutSessionDto {
  @ApiProperty({ description: 'Plano desejado', enum: PlanType })
  @IsEnum(PlanType, { message: 'Plano inválido.' })
  plan: PlanType;

  @ApiProperty({ description: 'Intervalo de cobrança (monthly ou annual)', enum: ['monthly', 'annual'], default: 'monthly', required: false })
  @IsOptional()
  @IsEnum(['monthly', 'annual'], { message: 'Intervalo inválido. Use "monthly" ou "annual".' })
  interval?: 'monthly' | 'annual' = 'monthly';
}
