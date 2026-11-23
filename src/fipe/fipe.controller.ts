import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FipeService } from './fipe.service';

@ApiTags('FIPE')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fipe')
export class FipeController {
  constructor(private readonly fipe: FipeService) {}

  @Get('brands')
  @ApiOperation({ summary: 'Marcas de carros na FIPE' })
  brands() {
    return this.fipe.brands();
  }

  @Get('brands/:brand/models')
  @ApiOperation({ summary: 'Modelos/versões de uma marca' })
  models(@Param('brand') brand: string) {
    return this.fipe.models(brand);
  }

  @Get('brands/:brand/models/:model/years')
  @ApiOperation({ summary: 'Anos-modelo de uma versão' })
  years(@Param('brand') brand: string, @Param('model') model: string) {
    return this.fipe.years(brand, model);
  }

  @Get('brands/:brand/models/:model/years/:year')
  @ApiOperation({ summary: 'Código FIPE e preço atual da versão/ano' })
  resolve(@Param('brand') brand: string, @Param('model') model: string, @Param('year') year: string) {
    return this.fipe.resolve(brand, model, year);
  }
}
