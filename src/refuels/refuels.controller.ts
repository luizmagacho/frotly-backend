import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { RefuelsService } from './refuels.service';
import { CreateRefuelDto } from './dto/create-refuel.dto';
import { UpdateRefuelDto } from './dto/update-refuel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('refuels')
@UseGuards(JwtAuthGuard)
export class RefuelsController {
  constructor(private readonly refuelsService: RefuelsService) {}

  @Post()
  create(@Body() createRefuelDto: CreateRefuelDto) {
    return this.refuelsService.create(createRefuelDto);
  }

  @Get()
  findAll(@Query('vehicleId') vehicleId?: string) {
    return this.refuelsService.findAll(vehicleId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.refuelsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRefuelDto: UpdateRefuelDto) {
    return this.refuelsService.update(id, updateRefuelDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.refuelsService.remove(id);
  }
}
