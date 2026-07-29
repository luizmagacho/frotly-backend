import { SetMetadata } from '@nestjs/common';
import { PlanType } from '../schemas/tenant.schema';

export const REQUIRED_PLAN_KEY = 'requiredPlan';
export const RequiresPlan = (plan: PlanType) => SetMetadata(REQUIRED_PLAN_KEY, plan);
