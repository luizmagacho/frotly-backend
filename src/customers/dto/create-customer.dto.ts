import { IsString, IsEnum, IsOptional, ValidateNested, IsObject, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerType, CustomerStatus } from '../schemas/customer.schema';

class AddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zipCode?: string;
}

export class CreateCustomerDto {
  @ApiProperty({ enum: CustomerType, description: 'Tipo de cliente (PF ou PJ)' })
  @IsEnum(CustomerType, { message: 'O tipo deve ser PF ou PJ.' })
  type: CustomerType;

  @ApiProperty({ description: 'Nome ou Razão Social' })
  @IsString({ message: 'O nome deve ser um texto.' })
  name: string;

  @ApiProperty({ description: 'CPF ou CNPJ' })
  @IsString({ message: 'O documento deve ser um texto.' })
  document: string;

  @ApiPropertyOptional({ description: 'E-mail do cliente' })
  @IsOptional()
  @IsEmail({}, { message: 'O e-mail deve ser válido.' })
  email?: string;

  @ApiPropertyOptional({ description: 'Telefone de contato' })
  @IsOptional()
  @IsString({ message: 'O telefone deve ser um texto.' })
  phone?: string;

  @ApiPropertyOptional({ type: AddressDto, description: 'Endereço do cliente' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional({ enum: CustomerStatus, description: 'Status do cliente' })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}
