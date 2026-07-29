import { Controller, Post, Get, Body, Req, Headers, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { TrialService } from './trial.service';
import { CancellationService } from './cancellation.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly trialService: TrialService,
    private readonly cancellationService: CancellationService,
  ) {}

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cria uma sessão de checkout do Stripe para assinar/trocar de plano' })
  createCheckout(@Body() dto: CreateCheckoutSessionDto, @Req() req: any) {
    return this.billingService.createCheckoutSession(req.user.tenantId, dto.plan, dto.interval);
  }

  @Get('portal')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Cria uma sessão do portal do Stripe para gerenciar a assinatura atual' })
  createPortal(@Req() req: any) {
    return this.billingService.createPortalSession(req.user.tenantId);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  webhook(@Req() req: Request, @Headers('stripe-signature') signature: string) {
    // req.rawBody is populated by Nest's `rawBody: true` app option (see main.ts) —
    // Stripe's signature check needs the exact raw bytes, not the parsed JSON body.
    return this.billingService.handleWebhook((req as any).rawBody, signature);
  }

  @Post('trial/payment-method')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Registra Payment Method para cobrança após trial' })
  setPaymentMethod(@Body() dto: { paymentMethodId: string }, @Req() req: any) {
    return this.trialService.setPaymentMethod(req.user.tenantId, dto.paymentMethodId);
  }

  @Get('trial/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Retorna status do período de teste' })
  getTrialStatus(@Req() req: any) {
    return this.trialService.getTrialStatus(req.user.tenantId);
  }

  @Post('trial/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Cancela o período de teste' })
  cancelTrial(@Req() req: any) {
    return this.trialService.cancelTrial(req.user.tenantId);
  }

  @Get('cancellation/penalty-info')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Retorna informações sobre multa de cancelamento' })
  getPenaltyInfo(@Req() req: any) {
    return this.cancellationService.getPenaltyInfo(req.user.tenantId);
  }

  @Post('cancellation/cancel-subscription')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Cancela assinatura e aplica multa se necessário' })
  cancelSubscription(@Body() dto: { reason?: string }, @Req() req: any) {
    return this.cancellationService.cancelSubscription(req.user.tenantId, dto.reason);
  }
}
