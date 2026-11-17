import {
  Body, Controller, DefaultValuePipe, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FinesService, FineListStatus } from './fines.service';
import { CreateFineDto } from './dto/create-fine.dto';
import { UpdateFineDto } from './dto/update-fine.dto';

@ApiTags('Multas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fines')
export class FinesController {
  constructor(private readonly finesService: FinesService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar multa (o motorista responsável é identificado pelo contrato, se não informado)' })
  create(@Body() dto: CreateFineDto) {
    return this.finesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar multas' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'OVERDUE', 'PAID', 'APPEALED', 'CANCELLED'] })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: FineListStatus,
    @Query('vehicleId') vehicleId?: string,
    @Query('driverId') driverId?: string,
    @Query('search') search?: string,
  ) {
    return this.finesService.findAll({ page, limit, status, vehicleId, driverId, search });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Totais de multas: a pagar, vencidas, em recurso, pagas no ano e a cobrar dos motoristas' })
  getSummary() {
    return this.finesService.getSummary();
  }

  @Get('responsible-driver')
  @ApiOperation({ summary: 'Motorista que estava com o veículo na data informada' })
  @ApiQuery({ name: 'vehicleId', required: true })
  @ApiQuery({ name: 'date', required: true })
  async responsibleDriver(@Query('vehicleId') vehicleId: string, @Query('date') date: string) {
    return { driver: await this.finesService.findResponsibleDriver(vehicleId, date) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de uma multa' })
  findOne(@Param('id') id: string) {
    return this.finesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar multa' })
  update(@Param('id') id: string, @Body() dto: UpdateFineDto) {
    return this.finesService.update(id, dto);
  }

  @Patch(':id/pay')
  @ApiOperation({ summary: 'Marcar multa como paga' })
  markAsPaid(@Param('id') id: string, @Body('paidAt') paidAt?: string) {
    return this.finesService.markAsPaid(id, paidAt);
  }

  @Patch(':id/driver-charge/pay')
  @ApiOperation({ summary: 'Marcar o repasse ao motorista como recebido' })
  markDriverChargePaid(@Param('id') id: string) {
    return this.finesService.markDriverChargePaid(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Excluir multa (remove também os lançamentos financeiros dela)' })
  remove(@Param('id') id: string) {
    return this.finesService.remove(id);
  }
}
