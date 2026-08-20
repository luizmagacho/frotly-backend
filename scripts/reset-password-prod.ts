/**
 * reset-password-prod.ts — Reseta a senha de um usuário por email.
 * Use variáveis de ambiente — NUNCA hardcode email ou senha aqui.
 *   TARGET_EMAIL=... NEW_PASSWORD=... npx ts-node scripts/reset-password-prod.ts
 * Ou use o script reset-user-password.ts que gera senha aleatória automaticamente.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument } from '../src/auth/schemas/user.schema';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const email = process.env.TARGET_EMAIL;
  const newPassword = process.env.NEW_PASSWORD;

  if (!email || !newPassword) {
    console.error('❌ Defina TARGET_EMAIL e NEW_PASSWORD como variáveis de ambiente.');
    console.error('   Ou use scripts/reset-user-password.ts para gerar senha aleatória.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const UserModel = app.get<Model<UserDocument>>(getModelToken('User'));

  console.log(`Buscando usuário: ${email}`);
  const user = await UserModel.findOne({ email });

  if (!user) {
    console.error(`❌ Usuário ${email} não encontrado.`);
    await app.close();
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await UserModel.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });

  console.log('✅ Senha atualizada com sucesso!');
  await app.close();
}

bootstrap().catch(err => {
  console.error('Falha:', err);
  process.exit(1);
});
