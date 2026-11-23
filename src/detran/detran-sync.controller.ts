import { Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MinRole } from '../auth/decorators/min-role.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { DetranSyncService } from './detran-sync.service';

@ApiTags('Detran (consulta automática)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('detran')
export class DetranSyncController {
  constructor(private readonly sync: DetranSyncService) {}

  @Get('status')
  @ApiOperation({ summary: 'Consulta automática ao Detran: se está ativa e a última verificação de cada veículo' })
  status(@Request() req) {
    return this.sync.status(req.user.tenantId);
  }

  @Post('vehicles/:id/sync')
  @MinRole(UserRole.ADMIN)
  @ApiOperation({ summary: 'Consultar agora as multas do veículo no Detran (1 vez a cada 24 h; tem custo)' })
  syncNow(@Request() req, @Param('id') id: string) {
    return this.sync.syncNow(req.user.tenantId, id);
  }
}
