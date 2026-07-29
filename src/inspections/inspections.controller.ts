import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { InspectionsService } from './inspections.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InspectionType } from './schemas/inspection.schema';

@ApiTags('Vistorias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar nova vistoria' })
  @ApiResponse({ status: 201, description: 'Vistoria registrada com sucesso.' })
  create(@Body() createInspectionDto: CreateInspectionDto, @Request() req: any) {
    return this.inspectionsService.create({
      ...createInspectionDto,
      tenantId: req.user.tenantId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Listar vistorias' })
  @ApiQuery({ name: 'rentalId', required: false, type: String, description: 'Filtrar por contrato' })
  @ApiQuery({ name: 'vehicleId', required: false, type: String, description: 'Filtrar por veículo' })
  @ApiQuery({ name: 'type', required: false, enum: InspectionType, description: 'Filtrar por tipo de vistoria' })
  findAll(
    @Query('rentalId') rentalId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('type') type?: InspectionType,
  ) {
    return this.inspectionsService.findAll({ rentalId, vehicleId, type });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar vistoria por ID' })
  @ApiResponse({ status: 404, description: 'Vistoria não encontrada.' })
  findOne(@Param('id') id: string) {
    return this.inspectionsService.findById(id);
  }
}
