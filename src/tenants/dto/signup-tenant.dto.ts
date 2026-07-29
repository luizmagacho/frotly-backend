import { IsString, IsEmail, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlanType } from '../schemas/tenant.schema';

export class SignupTenantDto {
  @ApiProperty({ description: 'Nome da locadora', example: 'Locadora Exemplo' })
  @IsString({ message: 'O nome da locadora deve ser um texto.' })
  @MinLength(2, { message: 'O nome da locadora deve ter no mínimo 2 caracteres.' })
  tenantName: string;

  @ApiProperty({ description: 'CNPJ (apenas números)', example: '12345678000199' })
  @IsString({ message: 'O CNPJ deve ser um texto.' })
  @MinLength(11, { message: 'CNPJ inválido.' })
  cnpj: string;

  @ApiProperty({ description: 'Nome do administrador', example: 'Maria Silva' })
  @IsString({ message: 'O nome do administrador deve ser um texto.' })
  adminName: string;

  @ApiProperty({ description: 'E-mail do administrador' })
  @IsEmail({}, { message: 'E-mail inválido.' })
  adminEmail: string;

  @ApiProperty({ description: 'Senha do administrador (mínimo 8 caracteres)' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  adminPassword: string;

  @ApiProperty({ description: 'ID do Stripe Payment Method para cobrança do trial', required: false })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ApiProperty({
    description: 'Plano de interesse escolhido no cadastro — é o plano cobrado ao fim do trial',
    enum: PlanType,
    required: false,
    default: PlanType.BASIC,
  })
  @IsOptional()
  @IsEnum(PlanType, { message: 'Plano inválido.' })
  plan?: PlanType;

  @ApiProperty({
    description: 'Periodicidade de cobrança escolhida no cadastro (mensal ou anual com 10% de desconto)',
    enum: ['monthly', 'annual'],
    required: false,
    default: 'monthly',
  })
  @IsOptional()
  @IsEnum(['monthly', 'annual'], { message: 'Periodicidade de cobrança inválida.' })
  billingInterval?: 'monthly' | 'annual';
}
