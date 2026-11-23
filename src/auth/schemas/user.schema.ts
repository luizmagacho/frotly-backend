import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type UserDocument = User & Document;

/**
 * Cargos dentro de uma locadora:
 * - READ: só consulta.
 * - WRITE: consulta, cadastra, edita e exclui registros da operação.
 * - ADMIN: tudo do WRITE + usuários, auditoria, dados da empresa e cobrança.
 * SUPERADMIN é da plataforma (Frotly), não de uma locadora.
 * Os antigos MANAGER/VIEWER são convertidos para ADMIN na inicialização (RoleMigrationService).
 */
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  WRITE = 'WRITE',
  READ = 'READ',
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  // Not unique on its own: the same email can be an admin at one tenant and a
  // manager at another. Uniqueness is per-tenant — see the compound index below.
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.READ })
  role: UserRole;

  @Prop({ default: true })
  isActive: boolean;

  /** Convidado que ainda não definiu a senha pelo link do e-mail de boas-vindas. */
  @Prop({ default: false })
  pendingInvite: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  invitedBy?: Types.ObjectId;

  @Prop()
  invitedAt?: Date;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  deactivatedAt?: Date;

  @Prop()
  resetPasswordToken?: string;

  @Prop()
  resetPasswordExpires?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
