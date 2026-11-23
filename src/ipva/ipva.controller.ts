import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { IpvaService } from './ipva.service';
import { CreateIpvaDto } from './dto/create-ipva.dto';
import { UpdateIpvaDto } from './dto/update-ipva.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ipva')
@UseGuards(JwtAuthGuard)
export class IpvaController {
  constructor(private readonly ipvaService: IpvaService) {}

  @Post()
  create(@Body() createIpvaDto: CreateIpvaDto) {
    return this.ipvaService.create(createIpvaDto);
  }

  @Get()
  findAll() {
    return this.ipvaService.findAll();
  }

  @Get('vehicle/:vehicleId')
  findByVehicle(@Param('vehicleId') vehicleId: string) {
    return this.ipvaService.findByVehicle(vehicleId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ipvaService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateIpvaDto: UpdateIpvaDto) {
    return this.ipvaService.update(id, updateIpvaDto);
  }

  @Patch(':id/pagar/:installmentNumber')
  payInstallment(
    @Param('id') id: string,
    @Param('installmentNumber') installmentNumber: string
  ) {
    return this.ipvaService.payInstallment(id, parseInt(installmentNumber, 10));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ipvaService.remove(id);
  }
}
