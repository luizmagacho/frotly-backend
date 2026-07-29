import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { InsurancesService } from './insurances.service';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { UpdateInsuranceDto } from './dto/update-insurance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Insurances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('insurances')
export class InsurancesController {
  constructor(private readonly insurancesService: InsurancesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new insurance policy' })
  create(@Request() req, @Body() createInsuranceDto: CreateInsuranceDto) {
    return this.insurancesService.create(req.user.tenantId, createInsuranceDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all insurances' })
  @ApiQuery({ name: 'vehicleId', required: false, description: 'Filter by vehicle ID' })
  findAll(@Request() req, @Query('vehicleId') vehicleId?: string) {
    return this.insurancesService.findAll(req.user.tenantId, vehicleId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific insurance policy' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.insurancesService.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an insurance policy' })
  update(@Request() req, @Param('id') id: string, @Body() updateInsuranceDto: UpdateInsuranceDto) {
    return this.insurancesService.update(req.user.tenantId, id, updateInsuranceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an insurance policy' })
  remove(@Request() req, @Param('id') id: string) {
    return this.insurancesService.remove(req.user.tenantId, id);
  }
}
