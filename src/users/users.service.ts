import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User, UserDocument, UserRole } from '../auth/schemas/user.schema';
import { Tenant, TenantDocument } from '../tenants/schemas/tenant.schema';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../notifications/email/email.service';
import { invalidateUserCache } from '../auth/user-cache';
import { InviteUserDto } from './dto/users.dto';

export const ROLE_LABELS: Record<string, string> = {
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.WRITE]: 'Edição',
  [UserRole.READ]: 'Somente leitura',
};

const INVITE_HOURS = 7 * 24;

export type Actor = { userId: string; tenantId: string };

/** Usuários de uma locadora (painel Compliance → Usuários). Só administradores chegam aqui. */
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  /** Limite de usuários ativos por locadora (convites pendentes contam; desativados não). */
  get maxUsers(): number {
    const n = Number(this.config.get('MAX_USERS_PER_TENANT'));
    return Number.isFinite(n) && n > 0 ? n : 5;
  }

  private tenantFilter(tenantId: string) {
    return { tenantId: new Types.ObjectId(tenantId), role: { $ne: UserRole.SUPERADMIN } };
  }

  private countActive(tenantId: string) {
    return this.userModel.countDocuments({ ...this.tenantFilter(tenantId), isActive: { $ne: false } });
  }

  private toView(u: any) {
    return {
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive !== false,
      pendingInvite: !!u.pendingInvite,
      inviteExpired: !!u.pendingInvite && (!u.resetPasswordExpires || new Date(u.resetPasswordExpires) < new Date()),
      invitedAt: u.invitedAt ?? null,
      lastLoginAt: u.lastLoginAt ?? null,
      createdAt: u.createdAt ?? null,
    };
  }

  async list(actor: Actor) {
    const users = await this.userModel
      .find(this.tenantFilter(actor.tenantId))
      .select('name email role isActive pendingInvite invitedAt lastLoginAt createdAt resetPasswordExpires')
      .sort({ isActive: -1, name: 1 })
      .lean();
    const used = users.filter((u) => u.isActive !== false).length;
    return { users: users.map((u) => this.toView(u)), used, limit: this.maxUsers, me: actor.userId };
  }

  private async findInTenant(actor: Actor, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Usuário não encontrado.');
    const user = await this.userModel.findOne({ _id: new Types.ObjectId(id), ...this.tenantFilter(actor.tenantId) });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  private async ensureLimit(actor: Actor) {
    if ((await this.countActive(actor.tenantId)) >= this.maxUsers) {
      throw new ForbiddenException(`Sua locadora já tem ${this.maxUsers} usuários ativos, o limite do sistema. Desative um usuário para liberar uma vaga.`);
    }
  }

  /** Impede deixar a locadora sem nenhum administrador ativo. */
  private async ensureNotLastAdmin(actor: Actor, user: UserDocument) {
    if (user.role !== UserRole.ADMIN || user.isActive === false) return;
    const otherAdmins = await this.userModel.countDocuments({
      ...this.tenantFilter(actor.tenantId),
      _id: { $ne: user._id },
      role: UserRole.ADMIN,
      isActive: { $ne: false },
      pendingInvite: { $ne: true },
    });
    if (otherAdmins === 0) throw new BadRequestException('A locadora precisa de pelo menos um administrador ativo.');
  }

  private ensureNotSelf(actor: Actor, user: UserDocument, what: string) {
    if (String(user._id) === actor.userId) throw new BadRequestException(`Você não pode ${what} o próprio usuário.`);
  }

  private async sendInvite(actor: Actor, user: UserDocument) {
    const token = await this.authService.issuePasswordToken(String(user._id), INVITE_HOURS);
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    const link = `${frontendUrl}/definir-senha?token=${token}`;
    const [tenant, inviter] = await Promise.all([
      this.tenantModel.findById(actor.tenantId).select('name').lean(),
      this.userModel.findById(actor.userId).select('name').lean(),
    ]);
    const emailSent = await this.emailService.sendWelcomeInvite({
      name: user.name,
      email: user.email,
      link,
      tenantName: tenant?.name ?? 'sua locadora',
      inviterName: inviter?.name,
      roleLabel: ROLE_LABELS[user.role] ?? user.role,
    });
    // Sem e-mail (provedor fora do ar ou não configurado), o admin recebe o link para enviar por outro canal.
    return { emailSent, inviteLink: emailSent ? undefined : link };
  }

  async invite(actor: Actor, dto: InviteUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.userModel.findOne({ ...this.tenantFilter(actor.tenantId), email });
    if (existing) {
      throw new ConflictException(
        existing.isActive === false
          ? 'Esse e-mail já pertence a um usuário desativado. Reative-o na lista.'
          : 'Já existe um usuário com esse e-mail.',
      );
    }
    await this.ensureLimit(actor);

    const user = await this.userModel.create({
      tenantId: new Types.ObjectId(actor.tenantId),
      email,
      name: dto.name.trim(),
      role: dto.role,
      // Senha aleatória que ninguém conhece: o acesso só começa quando o convidado cria a dele.
      password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
      isActive: true,
      pendingInvite: true,
      invitedBy: new Types.ObjectId(actor.userId),
      invitedAt: new Date(),
    });
    const sent = await this.sendInvite(actor, user);
    return { user: this.toView(user.toObject()), ...sent };
  }

  async resendInvite(actor: Actor, id: string) {
    const user = await this.findInTenant(actor, id);
    if (!user.pendingInvite) throw new BadRequestException('Esse usuário já criou a senha.');
    if (user.isActive === false) throw new BadRequestException('Reative o usuário antes de reenviar o convite.');
    user.invitedAt = new Date();
    await user.save();
    return this.sendInvite(actor, user);
  }

  async updateRole(actor: Actor, id: string, role: UserRole) {
    const user = await this.findInTenant(actor, id);
    this.ensureNotSelf(actor, user, 'mudar o cargo do');
    if (user.role === role) return this.toView(user.toObject());
    if (role !== UserRole.ADMIN) await this.ensureNotLastAdmin(actor, user);
    user.role = role;
    await user.save();
    invalidateUserCache(String(user._id));
    return this.toView(user.toObject());
  }

  async deactivate(actor: Actor, id: string) {
    const user = await this.findInTenant(actor, id);
    this.ensureNotSelf(actor, user, 'desativar');
    if (user.isActive === false) return this.toView(user.toObject());
    await this.ensureNotLastAdmin(actor, user);
    user.isActive = false;
    user.deactivatedAt = new Date();
    await user.save();
    invalidateUserCache(String(user._id));
    return this.toView(user.toObject());
  }

  async reactivate(actor: Actor, id: string) {
    const user = await this.findInTenant(actor, id);
    if (user.isActive !== false) return this.toView(user.toObject());
    await this.ensureLimit(actor);
    user.isActive = true;
    user.deactivatedAt = undefined;
    await user.save();
    invalidateUserCache(String(user._id));
    return this.toView(user.toObject());
  }
}
