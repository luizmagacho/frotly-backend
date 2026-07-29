import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { RefuelsService } from './refuels.service';
import { CreateRefuelDto } from './dto/create-refuel.dto';
import { UpdateRefuelDto } from './dto/update-refuel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';

@Controller('refuels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RefuelsController {
  constructor(private readonly refuelsService: RefuelsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() createRefuelDto: CreateRefuelDto) {
    return this.refuelsService.create(createRefuelDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findAll(@Query('vehicleId') vehicleId?: string) {
    return this.refuelsService.findAll(vehicleId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findOne(@Param('id') id: string) {
    return this.refuelsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id') id: string, @Body() updateRefuelDto: UpdateRefuelDto) {
    return this.refuelsService.update(id, updateRefuelDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string) {
    return this.refuelsService.remove(id);
  }
}
