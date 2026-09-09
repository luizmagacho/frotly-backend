import { Controller, Post, Body, UseGuards, Get, Patch, Param, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class TestNotificationDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

@ApiTags('Notificações')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test')
  @ApiOperation({ summary: 'Enviar notificação de teste (e-mail + WhatsApp)' })
  sendTest(@Body() dto: TestNotificationDto) {
    return this.notificationsService.sendTestNotification(dto.email, dto.phone);
  }

  @Get()
  @ApiOperation({ summary: 'Listar notificações in-app do usuário logado' })
  findAll(@Request() req: any) {
    return this.notificationsService.findForUser(req.user.tenantId, req.user.userId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Contagem de notificações não lidas do usuário logado' })
  countUnread(@Request() req: any) {
    return this.notificationsService.countUnread(req.user.tenantId, req.user.userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar uma notificação como lida' })
  markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.markAsRead(id, req.user.tenantId, req.user.userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas as notificações do usuário como lidas' })
  markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.tenantId, req.user.userId);
  }
}
