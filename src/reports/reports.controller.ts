import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe, Param, Req } from '@nestjs/common';
import { SalePlanService } from './sale-plan.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanGuard } from '../tenants/guards/plan.guard';
import { RequiresPlan } from '../tenants/decorators/requires-plan.decorator';
import { PlanType } from '../tenants/schemas/tenant.schema';

@ApiTags('Relatórios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlanGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly salePlanService: SalePlanService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'KPIs do dashboard' })
  getDashboardKpis() {
    return this.reportsService.getDashboardKpis();
  }

  @Get('monthly-revenue')
  @ApiOperation({ summary: 'Receita mensal' })
  getMonthlyRevenue(
    @Query('months', new DefaultValuePipe(6), ParseIntPipe) months: number,
  ) {
    return this.reportsService.getMonthlyRevenue(months);
  }

  @Get('financial')
  @ApiOperation({ summary: 'Lucro/Prejuízo por veículo' })
  getFinancialPerVehicle() {
    return this.reportsService.getFinancialPerVehicle();
  }

  @Get('mileage')
  @RequiresPlan(PlanType.PRO)
  @ApiOperation({ summary: 'Rodagem e custo por km por veículo (plano Pro)' })
  getMileagePerVehicle(@Query('days', new DefaultValuePipe(90), ParseIntPipe) days: number) {
    return this.reportsService.getMileagePerVehicle(Math.min(365, Math.max(7, days)));
  }

  @Get('sale-plan/:vehicleId')
  @RequiresPlan(PlanType.PRO)
  @ApiOperation({ summary: 'Plano de venda do veículo: melhor momento pela FIPE e pela quilometragem (plano Pro)' })
  getSalePlan(@Param('vehicleId') vehicleId: string, @Req() req: any, @Query('refresh') refresh?: string) {
    return this.salePlanService.getPlan(vehicleId, String(req.user?.tenantId), refresh === '1');
  }
}
