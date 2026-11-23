import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../schemas/user.schema';

type CachedUser = { at: number; isActive: boolean; role: string; tenantId: string; email: string };

/** Por quanto tempo o estado do usuário (ativo/cargo) fica em cache entre consultas ao banco. */
export const USER_CACHE_MS = 30_000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private cache = new Map<string, CachedUser>();

  constructor(
    configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET env var is missing or too short (min 32 chars). Refusing to start.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * O token vale até expirar, mas o usuário pode ter sido desativado ou trocado de cargo
   * depois do login. Confere no banco (com cache curto) e usa o cargo atual — o do token
   * pode estar desatualizado.
   */
  async validate(payload: any) {
    const userId = String(payload.sub ?? '');
    if (!Types.ObjectId.isValid(userId)) throw new UnauthorizedException('Sessão inválida.');

    let user = this.cache.get(userId);
    if (!user || Date.now() - user.at > USER_CACHE_MS) {
      const doc = await this.userModel.findById(userId).select('isActive role tenantId email').lean();
      if (!doc) throw new UnauthorizedException('Usuário não encontrado.');
      user = { at: Date.now(), isActive: doc.isActive !== false, role: doc.role, tenantId: String(doc.tenantId), email: doc.email };
      this.cache.set(userId, user);
      if (this.cache.size > 5000) this.cache.delete(this.cache.keys().next().value as string);
    }

    if (!user.isActive) throw new UnauthorizedException('Usuário desativado.');
    if (payload.tenantId && String(payload.tenantId) !== user.tenantId) throw new UnauthorizedException('Sessão inválida.');

    return { userId, email: user.email, role: user.role, tenantId: user.tenantId };
  }
}
