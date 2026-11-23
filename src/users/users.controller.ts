import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MinRole } from '../auth/decorators/min-role.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { UsersService } from './users.service';
import { InviteUserDto, UpdateUserRoleDto } from './dto/users.dto';

@ApiTags('Usuários')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@MinRole(UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private actor(req: any) {
    return { userId: String(req.user.userId), tenantId: String(req.user.tenantId) };
  }

  @Get()
  @ApiOperation({ summary: 'Usuários da locadora, com o limite de usuários ativos' })
  list(@Request() req: any) {
    return this.usersService.list(this.actor(req));
  }

  @Post()
  @ApiOperation({ summary: 'Convidar um usuário (envia o e-mail de boas-vindas para criar a senha)' })
  invite(@Request() req: any, @Body() dto: InviteUserDto) {
    return this.usersService.invite(this.actor(req), dto);
  }

  @Post(':id/resend-invite')
  @ApiOperation({ summary: 'Reenviar o convite (gera um novo link de 7 dias)' })
  resend(@Request() req: any, @Param('id') id: string) {
    return this.usersService.resendInvite(this.actor(req), id);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Mudar o cargo (READ, WRITE ou ADMIN)' })
  updateRole(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.usersService.updateRole(this.actor(req), id, dto.role);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Desativar (perde o acesso em seguida)' })
  deactivate(@Request() req: any, @Param('id') id: string) {
    return this.usersService.deactivate(this.actor(req), id);
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reativar' })
  reactivate(@Request() req: any, @Param('id') id: string) {
    return this.usersService.reactivate(this.actor(req), id);
  }
}
