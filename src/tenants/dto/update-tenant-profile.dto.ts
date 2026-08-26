import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/** Campos que o próprio admin da locadora pode editar em Configurações — plano, subdomínio
 * e ativação ficam restritos ao endpoint de superadmin (/tenants/:id). */
export class UpdateTenantProfileDto {
  @ApiPropertyOptional({ description: 'Nome da locadora' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'O nome deve ter no mínimo 2 caracteres.' })
  name?: string;

  @ApiPropertyOptional({ description: 'CNPJ (apenas números)' })
  @IsOptional()
  @IsString()
  @MinLength(11, { message: 'CNPJ inválido.' })
  cnpj?: string;

  @ApiPropertyOptional({ description: 'E-mail de contato' })
  @IsOptional()
  @IsEmail({}, { message: 'E-mail de contato inválido.' })
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Telefone de contato' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Endereço completo (rua, número, bairro)' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Cidade - UF' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'CEP' })
  @IsOptional()
  @IsString()
  zipCode?: string;
}
