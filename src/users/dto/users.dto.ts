import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TENANT_ROLES } from '../../auth/roles';
import { UserRole } from '../../auth/schemas/user.schema';

export class InviteUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome.' })
  @MaxLength(120)
  name: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @IsIn(TENANT_ROLES as unknown as string[], { message: 'Cargo inválido.' })
  role: UserRole;
}

export class UpdateUserRoleDto {
  @IsIn(TENANT_ROLES as unknown as string[], { message: 'Cargo inválido.' })
  role: UserRole;
}
