import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { Vehicle, VehicleStatus } from '../vehicles/schemas/vehicle.schema';
import { Driver } from '../drivers/schemas/driver.schema';
import { Rental, RentalStatus } from '../rentals/schemas/rental.schema';
import { Maintenance } from '../maintenances/schemas/maintenance.schema';

describe('DashboardService', () => {
  let service: DashboardService;
  let vehicleModel: { countDocuments: jest.Mock };
  let driverModel: { find: jest.Mock };
  let rentalModel: { countDocuments: jest.Mock; aggregate: jest.Mock };
  let maintenanceModel: { find: jest.Mock };

  beforeEach(async () => {
    vehicleModel = { countDocuments: jest.fn() };
    driverModel = { find: jest.fn() };
    rentalModel = { countDocuments: jest.fn(), aggregate: jest.fn() };
    maintenanceModel = { find: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue([]) }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getModelToken(Vehicle.name), useValue: vehicleModel },
        { provide: getModelToken(Driver.name), useValue: driverModel },
        { provide: getModelToken(Rental.name), useValue: rentalModel },
        { provide: getModelToken(Maintenance.name), useValue: maintenanceModel },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getKpis', () => {
    it('aggregates vehicle counts by status and active rentals', async () => {
      vehicleModel.countDocuments.mockImplementation((filter?: any) => {
        if (!filter) return Promise.resolve(10);
        if (filter.status === VehicleStatus.RENTED) return Promise.resolve(4);
        if (filter.status === VehicleStatus.AVAILABLE) return Promise.resolve(5);
        if (filter.status === VehicleStatus.MAINTENANCE) return Promise.resolve(1);
        if (filter.status === VehicleStatus.INACTIVE) return Promise.resolve(0);
        return Promise.resolve(0);
      });
      rentalModel.countDocuments.mockResolvedValue(4);

      const result = await service.getKpis();

      expect(result.vehicles.total).toBe(10);
      expect(result.vehicles.byStatus).toEqual({ AVAILABLE: 5, RENTED: 4, MAINTENANCE: 1, INACTIVE: 0 });
      expect(result.rentals).toEqual({ active: 4, idleVehicles: 5 });
      expect(rentalModel.countDocuments).toHaveBeenCalledWith({ status: RentalStatus.ACTIVE });
    });
  });

  describe('getCharts', () => {
    it('formats aggregated monthly revenue as MM/YYYY', async () => {
      rentalModel.aggregate.mockResolvedValue([
        { _id: { year: 2026, month: 3 }, total: 1500 },
        { _id: { year: 2026, month: 4 }, total: 2200 },
      ]);

      const result = await service.getCharts(6);

      expect(result.revenue).toEqual([
        { _id: '03/2026', total: 1500 },
        { _id: '04/2026', total: 2200 },
      ]);
      expect(rentalModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ $limit: 6 })]),
      );
    });
  });

  describe('getAlerts', () => {
    it('returns scheduled maintenances and expiring driver licenses within the next month', async () => {
      driverModel.find.mockResolvedValue([{ name: 'Motorista X' }]);
      maintenanceModel.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([{ description: 'Troca de óleo' }]),
      });

      const result = await service.getAlerts();

      expect(result.cnh).toEqual([{ name: 'Motorista X' }]);
      expect(result.maintenance).toEqual([{ description: 'Troca de óleo' }]);
      expect(result.ipva).toEqual([]);
      expect(result.licensing).toEqual([]);
    });
  });
});
