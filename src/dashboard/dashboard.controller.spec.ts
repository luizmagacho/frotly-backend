import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: { getKpis: jest.Mock; getCharts: jest.Mock; getAlerts: jest.Mock };

  beforeEach(async () => {
    service = {
      getKpis: jest.fn().mockResolvedValue({ vehicles: {} }),
      getCharts: jest.fn().mockResolvedValue({ revenue: [] }),
      getAlerts: jest.fn().mockResolvedValue({ ipva: [], licensing: [], maintenance: [], cnh: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: service }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getKpis delegates to the service', async () => {
    const result = await controller.getKpis();
    expect(service.getKpis).toHaveBeenCalled();
    expect(result).toEqual({ vehicles: {} });
  });

  it('getCharts defaults to 12 months when none is given', async () => {
    await controller.getCharts(undefined as any);
    expect(service.getCharts).toHaveBeenCalledWith(12);
  });

  it('getCharts forwards a given months value', async () => {
    await controller.getCharts(3);
    expect(service.getCharts).toHaveBeenCalledWith(3);
  });

  it('getAlerts delegates to the service', async () => {
    const result = await controller.getAlerts();
    expect(service.getAlerts).toHaveBeenCalled();
    expect(result).toEqual({ ipva: [], licensing: [], maintenance: [], cnh: [] });
  });
});
