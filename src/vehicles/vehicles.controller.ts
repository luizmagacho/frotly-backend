import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/create-vehicle.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VehicleStatus } from './schemas/vehicle.schema';

@ApiTags('Veículos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar novo veículo na frota' })
  create(@Body() createVehicleDto: CreateVehicleDto) {
    return this.vehiclesService.create(createVehicleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os veículos' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: VehicleStatus })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: VehicleStatus,
  ) {
    return this.vehiclesService.findAll(page, limit, search, status);
  }

  @Get('alerts/expiring-documents')
  @ApiOperation({ summary: 'Veículos com documentos próximos ao vencimento' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  findExpiringDocuments(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.vehiclesService.findWithExpiringDocuments(days);
  }

  @Get('stats/by-status')
  @ApiOperation({ summary: 'Estatísticas de veículos por status' })
  countByStatus() {
    return this.vehiclesService.countByStatus();
  }

  @Get('plate/:plate')
  @ApiOperation({ summary: 'Buscar veículo por placa' })
  findByPlate(@Param('plate') plate: string) {
    return this.vehiclesService.findByLicensePlate(plate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar veículo por ID' })
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar dados do veículo' })
  update(@Param('id') id: string, @Body() updateData: UpdateVehicleDto) {
    return this.vehiclesService.update(id, updateData);
  }

  @Post(':id/photos')
  @ApiOperation({ summary: 'Upload de foto do veículo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads/vehicles',
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(new Error('Apenas imagens são permitidas!'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.vehiclesService.addPhoto(id, `/uploads/vehicles/${file.filename}`);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover veículo' })
  remove(@Param('id') id: string) {
    return this.vehiclesService.remove(id);
  }
}
