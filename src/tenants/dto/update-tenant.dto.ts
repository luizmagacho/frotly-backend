import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsHexColor } from 'class-validator';
import { CreateTenantDto } from './create-tenant.dto';

export class UpdateTenantDto extends PartialType(CreateTenantDto) {
  @ApiPropertyOptional({ description: 'URL do logo do tenant' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Cor primária do tema, em hexadecimal', example: '#1e6e6b' })
  @IsOptional()
  @IsHexColor({ message: 'A cor primária deve ser um hexadecimal válido, ex.: #1e6e6b.' })
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'Domínio customizado do tenant' })
  @IsOptional()
  @IsString()
  customDomain?: string;

  @ApiPropertyOptional({ description: 'Ativa/desativa o tenant' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
