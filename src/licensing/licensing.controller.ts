import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { LicensingService } from './licensing.service';
import { CreateLicensingDto } from './dto/create-licensing.dto';
import { UpdateLicensingDto } from './dto/update-licensing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Licensing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('licensing')
export class LicensingController {
  constructor(private readonly licensingService: LicensingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new licensing record' })
  create(@Request() req, @Body() dto: CreateLicensingDto) {
    return this.licensingService.create(req.user.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all licensing records' })
  @ApiQuery({ name: 'vehicleId', required: false })
  findAll(@Request() req, @Query('vehicleId') vehicleId?: string) {
    return this.licensingService.findAll(req.user.tenantId, vehicleId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific licensing record' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.licensingService.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a licensing record' })
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateLicensingDto) {
    return this.licensingService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a licensing record' })
  remove(@Request() req, @Param('id') id: string) {
    return this.licensingService.remove(req.user.tenantId, id);
  }
}
