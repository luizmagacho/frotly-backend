import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument } from '../src/auth/schemas/user.schema';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  console.log('Connecting to database...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  console.log('Successfully connected! Fetching user model...');
  
  const UserModel = app.get<Model<UserDocument>>(getModelToken('User'));
  
  const email = 'contato@rogercentroautomotivo.com.br';
  const newPassword = 'Roger@123!';
  
  console.log(`Searching for user with email: ${email}`);
  const user = await UserModel.findOne({ email });
  
  if (!user) {
    console.error(`❌ User with email ${email} not found.`);
    await app.close();
    process.exit(1);
  }

  console.log('User found! Hashing new password...');
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  
  console.log('Updating password in database...');
  await UserModel.updateOne(
    { _id: user._id },
    { $set: { password: hashedPassword } }
  );
  
  console.log('✅ Password successfully updated!');
  
  await app.close();
}

bootstrap().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
