import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant, TenantDocument } from './schemas/tenant.schema';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { SignupTenantDto } from './dto/signup-tenant.dto';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '../auth/schemas/user.schema';
import { TrialService } from '../billing/trial.service';

@Injectable()
export class TenantsService {
  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    private authService: AuthService,
    private trialService: TrialService,
  ) {}

  private slugify(input: string): string {
    return input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  private async generateUniqueSubdomain(name: string): Promise<string> {
    const base = this.slugify(name) || 'locadora';
    let candidate = base;
    let suffix = 1;
    while (await this.tenantModel.exists({ subdomain: candidate })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    const existing = await this.tenantModel.findOne({ cnpj: createTenantDto.cnpj });
    if (existing) {
      throw new ConflictException('Já existe uma locadora cadastrada com este CNPJ.');
    }

    const subdomain = createTenantDto.subdomain
      ? this.slugify(createTenantDto.subdomain)
      : await this.generateUniqueSubdomain(createTenantDto.name);

    const tenant = new this.tenantModel({ ...createTenantDto, subdomain });
    return tenant.save();
  }

  /**
   * Self-serve signup: creates the tenant and its first admin user together.
   * MongoDB transactions require a replica set, which this deployment doesn't
   * assume, so this uses a compensating rollback instead of a real transaction:
   * if user creation fails, the just-created tenant is deleted.
   */
  async signup(dto: SignupTenantDto) {
    const existingTenant = await this.tenantModel.findOne({ cnpj: dto.cnpj });
    if (existingTenant) {
      throw new ConflictException('Já existe uma locadora cadastrada com este CNPJ.');
    }

    // No email pre-check here: email is unique per-tenant, not platform-wide, and
    // this tenant is brand new, so it can never already have this email registered.
    const subdomain = await this.generateUniqueSubdomain(dto.tenantName);
    const tenant = await new this.tenantModel({
      name: dto.tenantName,
      cnpj: dto.cnpj,
      contactEmail: dto.adminEmail,
      subdomain,
    }).save();

    const tenantId = (tenant as any)._id.toString();

    try {
      await this.authService.createUser(
        dto.adminEmail,
        dto.adminPassword,
        dto.adminName,
        tenantId,
        UserRole.ADMIN,
      );

      // Salvar payment method se fornecido
      if (dto.paymentMethodId) {
        await this.trialService.setPaymentMethod(tenantId, dto.paymentMethodId);
      }

      // Iniciar trial já no plano e periodicidade de interesse — é isso que será cobrado ao fim do trial
      await this.trialService.initiateTrial(tenantId, dto.plan, dto.billingInterval);
    } catch (error) {
      await this.authService.deleteUsersByTenant(tenantId);
      await this.tenantModel.deleteOne({ _id: tenant._id });
      throw error;
    }

    return this.authService.login(dto.adminEmail, dto.adminPassword);
  }

  findAll(): Promise<Tenant[]> {
    return this.tenantModel.find().exec();
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantModel.findById(id).exec();
    if (!tenant) {
      throw new NotFoundException('Locadora não encontrada.');
    }
    return tenant;
  }

  /** Public branding lookup — no auth required, used by the frontend to theme the login page per tenant. */
  async findPublicBySubdomain(subdomain: string) {
    const tenant = await this.tenantModel
      .findOne({ subdomain: subdomain.toLowerCase(), isActive: true })
      .select('name subdomain logoUrl primaryColor customDomain')
      .exec();
    if (!tenant) {
      throw new NotFoundException('Locadora não encontrada.');
    }
    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.tenantModel
      .findByIdAndUpdate(id, updateTenantDto, { new: true })
      .exec();
    if (!tenant) {
      throw new NotFoundException('Locadora não encontrada.');
    }
    return tenant;
  }

  async remove(id: string): Promise<void> {
    const result = await this.tenantModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Locadora não encontrada.');
    }
  }
}
