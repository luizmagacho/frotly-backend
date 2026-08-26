import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User, UserDocument } from './schemas/user.schema';
import { Tenant, TenantDocument } from '../tenants/schemas/tenant.schema';
import { EmailService } from '../notifications/email/email.service';

export interface TenantOption {
  id: string;
  name: string;
  subdomain: string;
}

export type LoginResult =
  | { accessToken: string; user: any }
  | { requiresTenantSelection: true; tenants: TenantOption[] };

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Tenant.name)
    private tenantModel: Model<TenantDocument>,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  /**
   * Email is unique per-tenant, not platform-wide, so the same email+password
   * can legitimately match more than one tenant. Password is checked against
   * every candidate before anything about tenant membership is revealed, so a
   * wrong password never leaks which tenants an email belongs to.
   */
  async login(email: string, password: string, tenantId?: string): Promise<LoginResult> {
    const candidates = await this.userModel.find({ email: email.toLowerCase(), isActive: true });

    const matches: UserDocument[] = [];
    for (const candidate of candidates) {
      if (await bcrypt.compare(password, candidate.password)) {
        matches.push(candidate);
      }
    }

    if (matches.length === 0) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    let user = matches[0];
    if (matches.length > 1) {
      if (tenantId) {
        const chosen = matches.find((m) => m.tenantId.toString() === tenantId);
        if (!chosen) {
          throw new UnauthorizedException('E-mail ou senha incorretos.');
        }
        user = chosen;
      } else {
        const tenants = await this.tenantModel
          .find({ _id: { $in: matches.map((m) => m.tenantId) } })
          .select('name subdomain')
          .exec();
        return {
          requiresTenantSelection: true,
          tenants: tenants.map((t) => ({
            id: (t as any)._id.toString(),
            name: t.name,
            subdomain: t.subdomain,
          })),
        };
      }
    }

    const payload = { sub: user._id, email: user.email, role: user.role, tenantId: user.tenantId };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async createUser(email: string, password: string, name: string, tenantId: string, role?: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new this.userModel({
      email,
      password: hashedPassword,
      name,
      tenantId,
      role,
    });
    return user.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  /** Usado para desfazer um signup parcialmente concluído (ex.: falha ao configurar cobrança). */
  async deleteUsersByTenant(tenantId: string): Promise<void> {
    await this.userModel.deleteMany({ tenantId });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.findByEmail(email);
    if (!user) {
      // Return silently to prevent email enumeration
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Expires in 1 hour
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    await this.userModel.updateOne(
      { _id: user._id },
      { 
        $set: { 
          resetPasswordToken: hashedToken,
          resetPasswordExpires: expires 
        } 
      }
    );

    await this.emailService.sendPasswordResetEmail(user.name, user.email, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userModel.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Token inválido ou expirado.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: { password: hashedPassword },
        $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 },
      }
    );
  }

  async updateUserName(userId: string, name: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $set: { name } });
  }
}
