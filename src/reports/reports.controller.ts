import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
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
  constructor(private readonly reportsService: ReportsService) {}

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
  @RequiresPlan(PlanType.PRO)
  @ApiOperation({ summary: 'Lucro/Prejuízo por veículo' })
  getFinancialPerVehicle() {
    return this.reportsService.getFinancialPerVehicle();
  }

  @Get('mileage')
  @RequiresPlan(PlanType.PRO)
  @ApiOperation({ summary: 'Quilometragem por veículo' })
  getMileagePerVehicle() {
    return this.reportsService.getMileagePerVehicle();
  }
}
