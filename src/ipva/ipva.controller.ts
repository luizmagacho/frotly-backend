import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { IpvaService } from './ipva.service';
import { CreateIpvaDto } from './dto/create-ipva.dto';
import { UpdateIpvaDto } from './dto/update-ipva.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';

@Controller('ipva')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IpvaController {
  constructor(private readonly ipvaService: IpvaService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() createIpvaDto: CreateIpvaDto) {
    return this.ipvaService.create(createIpvaDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findAll() {
    return this.ipvaService.findAll();
  }

  @Get('vehicle/:vehicleId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findByVehicle(@Param('vehicleId') vehicleId: string) {
    return this.ipvaService.findByVehicle(vehicleId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findOne(@Param('id') id: string) {
    return this.ipvaService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id') id: string, @Body() updateIpvaDto: UpdateIpvaDto) {
    return this.ipvaService.update(id, updateIpvaDto);
  }

  @Patch(':id/pagar/:installmentNumber')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  payInstallment(
    @Param('id') id: string,
    @Param('installmentNumber') installmentNumber: string
  ) {
    return this.ipvaService.payInstallment(id, parseInt(installmentNumber, 10));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string) {
    return this.ipvaService.remove(id);
  }
}
