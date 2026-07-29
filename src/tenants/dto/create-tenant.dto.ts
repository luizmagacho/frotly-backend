import { IsString, IsOptional, IsEmail, IsEnum, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanType } from '../schemas/tenant.schema';

export class CreateTenantDto {
  @ApiProperty({ description: 'Nome da locadora', example: 'Locadora Exemplo' })
  @IsString({ message: 'O nome deve ser um texto.' })
  @MinLength(2, { message: 'O nome deve ter no mínimo 2 caracteres.' })
  name: string;

  @ApiProperty({ description: 'CNPJ (apenas números)', example: '12345678000199' })
  @IsString({ message: 'O CNPJ deve ser um texto.' })
  @MinLength(11, { message: 'CNPJ inválido.' })
  cnpj: string;

  @ApiPropertyOptional({ description: 'E-mail de contato' })
  @IsOptional()
  @IsEmail({}, { message: 'E-mail de contato inválido.' })
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Telefone de contato' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Plano contratado', enum: PlanType })
  @IsOptional()
  @IsEnum(PlanType, { message: 'Plano inválido.' })
  plan?: PlanType;

  @ApiPropertyOptional({ description: 'Subdomínio desejado (ex.: "acme" para acme.gestorfrota.com.br). Gerado a partir do nome se omitido.' })
  @IsOptional()
  @IsString()
  subdomain?: string;
}
