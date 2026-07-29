import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { join } from 'path';
import { tenantPlugin } from './common/tenant.plugin';
import { TenantMiddleware } from './common/tenant.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { RentalsModule } from './rentals/rentals.module';
import { MaintenancesModule } from './maintenances/maintenances.module';
import { DetranModule } from './detran/detran.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HistoryModule } from './history/history.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TenantsModule } from './tenants/tenants.module';
import { LlmModule } from './llm/llm.module';
import { InspectionsModule } from './inspections/inspections.module';
import { CustomersModule } from './customers/customers.module';
import { ReservationsModule } from './reservations/reservations.module';
import { BillingModule } from './billing/billing.module';
import { FinancialEntriesModule } from './financial-entries/financial-entries.module';
import { InsurancesModule } from './insurances/insurances.module';
import { RefuelsModule } from './refuels/refuels.module';
import { IpvaModule } from './ipva/ipva.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({ isGlobal: true }),

    // Schedule (cron jobs)
    ScheduleModule.forRoot(),

    // Rate limiting — default bucket for every route; auth/LLM routes set stricter overrides
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),

    // Database
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>(
          'MONGODB_URI',
          'mongodb://localhost:27017/gestor-frota-pr',
        ),
        connectionFactory: (connection) => {
          connection.plugin(tenantPlugin);
          return connection;
        },
      }),
      inject: [ConfigService],
    }),

    // Static file serving for uploads
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),

    // Feature modules
    AuthModule,
    DriversModule,
    VehiclesModule,
    RentalsModule,
    MaintenancesModule,
    DetranModule,
    NotificationsModule,
    HistoryModule,
    ReportsModule,
    DashboardModule,
    TenantsModule,
    LlmModule,
    InspectionsModule,
    CustomersModule,
    ReservationsModule,
    BillingModule,
    FinancialEntriesModule,
    InsurancesModule,
    RefuelsModule,
    IpvaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
