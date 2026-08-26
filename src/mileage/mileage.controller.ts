import { Controller, Get, Post, Body, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { MileageService } from './mileage.service';
import { CreateMileageDto } from './dto/create-mileage.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Mileage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mileage')
export class MileageController {
  constructor(private readonly mileageService: MileageService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new mileage reading' })
  create(@Body() dto: CreateMileageDto) {
    return this.mileageService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all mileage readings' })
  @ApiQuery({ name: 'vehicleId', required: false })
  findAll(@Query('vehicleId') vehicleId?: string) {
    return this.mileageService.findAll(vehicleId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific mileage reading' })
  findOne(@Param('id') id: string) {
    return this.mileageService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a mileage reading' })
  remove(@Param('id') id: string) {
    return this.mileageService.remove(id);
  }
}
