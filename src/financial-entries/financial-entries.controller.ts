import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateFinancialEntryDto,
  FinancialEntriesService,
  UpdateFinancialEntryDto,
} from './financial-entries.service';

@ApiTags('Financeiro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('financial-entries')
export class FinancialEntriesController {
  constructor(private readonly financialEntriesService: FinancialEntriesService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar novo lançamento financeiro (entrada ou saída)' })
  create(@Body() dto: CreateFinancialEntryDto) {
    return this.financialEntriesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar lançamentos manuais' })
  @ApiQuery({ name: 'vehicleId', required: false })
  findAll(@Query('vehicleId') vehicleId?: string) {
    return this.financialEntriesService.findAll(vehicleId);
  }

  @Get('vehicle/:vehicleId/ledger')
  @ApiOperation({ summary: 'Livro caixa completo do veículo (lançamentos manuais + manutenções + aluguéis pagos)' })
  getVehicleLedger(@Param('vehicleId') vehicleId: string) {
    return this.financialEntriesService.getVehicleLedger(vehicleId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Editar lançamento manual' })
  update(@Param('id') id: string, @Body() dto: UpdateFinancialEntryDto) {
    return this.financialEntriesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir lançamento manual' })
  remove(@Param('id') id: string) {
    return this.financialEntriesService.remove(id);
  }
}
