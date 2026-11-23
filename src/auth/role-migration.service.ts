import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from './schemas/user.schema';

/**
 * Converte os cargos antigos (MANAGER/VIEWER) para ADMIN: todos os usuários que já
 * existiam antes dos cargos READ/WRITE/ADMIN viram administradores. Idempotente —
 * depois da primeira execução não encontra mais nada para mudar.
 */
@Injectable()
export class RoleMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RoleMigrationService.name);

  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async onApplicationBootstrap() {
    try {
      const res = await this.userModel.updateMany(
        { role: { $in: ['MANAGER', 'VIEWER'] } } as any,
        { $set: { role: UserRole.ADMIN } },
      );
      if (res.modifiedCount) this.logger.log(`${res.modifiedCount} usuário(s) com cargo antigo convertido(s) para ADMIN.`);
    } catch (e: any) {
      this.logger.error(`Falha ao migrar cargos antigos: ${e.message}`);
    }
  }
}
