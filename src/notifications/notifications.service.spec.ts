import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { NotificationsService } from './notifications.service';
import { DriversService } from '../drivers/drivers.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { RentalsService } from '../rentals/rentals.service';
import { EmailService } from './email/email.service';
import { WhatsAppService } from './whatsapp/whatsapp.service';
import { Notification } from './schemas/notification.schema';
import { User } from '../auth/schemas/user.schema';
import { Tenant, PlanType } from '../tenants/schemas/tenant.schema';

describe('NotificationsService — WhatsApp só no Enterprise', () => {
  const enterprise = new Types.ObjectId();
  const pro = new Types.ObjectId();

  let service: NotificationsService;
  let whatsApp: Record<string, jest.Mock>;
  let email: Record<string, jest.Mock>;
  let tenantFind: jest.Mock;
  const rentals = { findOverduePayments: jest.fn(), findUpcomingPayments: jest.fn(), findRentalsForMonthlyMileage: jest.fn() };
  const drivers = { findWithExpiringLicense: jest.fn() };

  const overdueRental = (tenantId: Types.ObjectId) => ({
    tenantId,
    driverId: { name: 'Motorista', email: 'm@x.com', phone: '41999990000' },
    vehicleId: { licensePlate: 'ABC1D23' },
    payments: [{ status: 'PENDING', dueDate: new Date(Date.now() - 3 * 864e5), amount: 500 }],
  });

  beforeEach(async () => {
    whatsApp = {
      sendPaymentOverdueAlert: jest.fn().mockResolvedValue(undefined),
      sendLicenseExpirationWarning: jest.fn().mockResolvedValue(undefined),
      sendMileageUpdateReminder: jest.fn().mockResolvedValue(undefined),
      sendPaymentUpcomingWarning: jest.fn().mockResolvedValue(undefined),
    };
    email = {
      sendPaymentOverdue: jest.fn().mockResolvedValue(undefined),
      sendLicenseExpirationWarning: jest.fn().mockResolvedValue(undefined),
      sendMileageUpdateReminder: jest.fn().mockResolvedValue(undefined),
    };
    tenantFind = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([{ _id: enterprise }]) }),
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: DriversService, useValue: drivers },
        { provide: VehiclesService, useValue: {} },
        { provide: RentalsService, useValue: rentals },
        { provide: EmailService, useValue: email },
        { provide: WhatsAppService, useValue: whatsApp },
        { provide: getModelToken(Notification.name), useValue: {} },
        { provide: getModelToken(User.name), useValue: {} },
        { provide: getModelToken(Tenant.name), useValue: { find: tenantFind } },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  it('consulta só tenants Enterprise ativos', async () => {
    rentals.findOverduePayments.mockResolvedValue([]);
    await service.checkOverduePayments();
    expect(tenantFind).toHaveBeenCalledWith({ plan: PlanType.ENTERPRISE, isActive: { $ne: false } });
  });

  it('atraso: WhatsApp só para o tenant Enterprise; e-mail para todos', async () => {
    rentals.findOverduePayments.mockResolvedValue([overdueRental(enterprise), overdueRental(pro)]);
    await service.checkOverduePayments();
    expect(whatsApp.sendPaymentOverdueAlert).toHaveBeenCalledTimes(1);
    expect(email.sendPaymentOverdue).toHaveBeenCalledTimes(2);
  });

  it('CNH vencendo: sem WhatsApp para tenant fora do Enterprise', async () => {
    drivers.findWithExpiringLicense.mockResolvedValue([
      { tenantId: pro, name: 'A', email: 'a@x.com', phone: '1', licenseExpiration: new Date(Date.now() + 10 * 864e5) },
      { tenantId: enterprise, name: 'B', email: 'b@x.com', phone: '2', licenseExpiration: new Date(Date.now() + 10 * 864e5) },
    ]);
    await service.checkExpiringLicenses();
    expect(whatsApp.sendLicenseExpirationWarning).toHaveBeenCalledTimes(1);
    expect(whatsApp.sendLicenseExpirationWarning).toHaveBeenCalledWith('B', '2', expect.any(Number));
    expect(email.sendLicenseExpirationWarning).toHaveBeenCalledTimes(2);
  });

  it('lembrete de km: sem WhatsApp quando nenhum tenant é Enterprise', async () => {
    tenantFind.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });
    rentals.findRentalsForMonthlyMileage.mockResolvedValue([overdueRental(enterprise)]);
    await service.checkMonthlyMileage();
    expect(whatsApp.sendMileageUpdateReminder).not.toHaveBeenCalled();
    expect(email.sendMileageUpdateReminder).toHaveBeenCalledTimes(1);
  });
});
