import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailService } from './email/email.service';
import { WhatsAppService } from './whatsapp/whatsapp.service';
import { DriversModule } from '../drivers/drivers.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { RentalsModule } from '../rentals/rentals.module';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Tenant, TenantSchema } from '../tenants/schemas/tenant.schema';

@Module({
  imports: [
    ConfigModule,
    DriversModule,
    VehiclesModule,
    RentalsModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService, WhatsAppService],
  exports: [EmailService, WhatsAppService, NotificationsService],
})
export class NotificationsModule {}
