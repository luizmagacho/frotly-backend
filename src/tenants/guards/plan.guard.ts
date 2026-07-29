import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { REQUIRED_PLAN_KEY } from '../decorators/requires-plan.decorator';
import { Tenant, TenantDocument, PlanType } from '../schemas/tenant.schema';

const PLAN_RANK: Record<PlanType, number> = {
  [PlanType.BASIC]: 0,
  [PlanType.PRO]: 1,
  [PlanType.ENTERPRISE]: 2,
};

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<PlanType>(REQUIRED_PLAN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @RequiresPlan() on this route — plan doesn't gate it.
    if (!requiredPlan) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.tenantId) {
      throw new ForbiddenException('Recurso não disponível para o seu plano.');
    }

    if (user.tenantId === 'ADMIN') {
      return true;
    }

    const tenant = await this.tenantModel.findById(user.tenantId).select('plan').exec();
    if (!tenant || PLAN_RANK[tenant.plan] < PLAN_RANK[requiredPlan]) {
      throw new ForbiddenException(`Este recurso requer o plano ${requiredPlan} ou superior.`);
    }

    return true;
  }
}
