import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DetranService } from './detran.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanGuard } from '../tenants/guards/plan.guard';
import { RequiresPlan } from '../tenants/decorators/requires-plan.decorator';
import { PlanType } from '../tenants/schemas/tenant.schema';

@ApiTags('Detran PR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlanGuard)
@RequiresPlan(PlanType.ENTERPRISE)
@Controller('detran')
export class DetranController {
  constructor(private readonly detranService: DetranService) {}

  @Get('vehicle/:plate/:renavam')
  @ApiOperation({ summary: 'Consulta completa de veículo no Detran PR (multas, IPVA, licenciamento)' })
  queryVehicle(@Param('plate') plate: string, @Param('renavam') renavam: string) {
    return this.detranService.queryVehicle(plate, renavam);
  }

  @Get('fines/:plate')
  @ApiOperation({ summary: 'Consultar multas de um veículo' })
  queryFines(@Param('plate') plate: string) {
    return this.detranService.queryFines(plate);
  }

  @Get('ipva/:renavam')
  @ApiOperation({ summary: 'Consultar situação do IPVA' })
  queryIpva(@Param('renavam') renavam: string) {
    return this.detranService.queryIpva(renavam);
  }

  @Get('licensing/:renavam')
  @ApiOperation({ summary: 'Consultar situação do licenciamento' })
  queryLicensing(@Param('renavam') renavam: string) {
    return this.detranService.queryLicensing(renavam);
  }
}
