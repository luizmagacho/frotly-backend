import { Controller, Get, Header, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MinRole } from '../auth/decorators/min-role.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { AuditQuery, AuditService } from './audit.service';

@ApiTags('Auditoria')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@MinRole(UserRole.ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Quem criou, editou ou excluiu cada registro da locadora' })
  list(@Request() req: any, @Query() q: AuditQuery) {
    return this.auditService.list(String(req.user.tenantId), q);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="auditoria-frotly.csv"')
  @ApiOperation({ summary: 'Exportar a auditoria filtrada em CSV' })
  export(@Request() req: any, @Query() q: AuditQuery) {
    return this.auditService.exportCsv(String(req.user.tenantId), q);
  }
}
