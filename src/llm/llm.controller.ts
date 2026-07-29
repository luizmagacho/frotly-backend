import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LlmService } from './llm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanGuard } from '../tenants/guards/plan.guard';
import { RequiresPlan } from '../tenants/decorators/requires-plan.decorator';
import { PlanType } from '../tenants/schemas/tenant.schema';

@ApiTags('LLM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlanGuard)
@RequiresPlan(PlanType.PRO)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post('test-intent')
  async testIntent(@Body('message') message: string) {
    return this.llmService.parseIntent(message);
  }

  @Post('test-cashflow')
  async testCashflow(@Body('text') text: string) {
    return this.llmService.analyzeTransaction(text);
  }
}
