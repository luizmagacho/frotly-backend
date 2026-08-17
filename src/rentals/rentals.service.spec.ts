import { Test, TestingModule } from '@nestjs/testing';
import { RentalsService } from './rentals.service';
import { getModelToken } from '@nestjs/mongoose';
import { Rental, PaymentFrequency } from './schemas/rental.schema';
import { VehiclesService } from '../vehicles/vehicles.service';

describe('RentalsService - generatePaymentSchedule', () => {
  let service: any; // Using any to access private method for testing

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentalsService,
        { provide: getModelToken(Rental.name), useValue: {} },
        { provide: VehiclesService, useValue: {} },
      ],
    }).compile();

    service = module.get<RentalsService>(RentalsService);
  });

  it('deve gerar 12 pagamentos se não houver expectedEndDate', () => {
    const startDate = new Date('2026-08-12T12:00:00Z');
    const payments = service.generatePaymentSchedule(startDate, 1000, PaymentFrequency.MONTHLY);
    
    expect(payments.length).toBe(12);
    // Primeiro vencimento deve ser 1 mês após o startDate
    expect(payments[0].dueDate.toISOString().startsWith('2026-09-12')).toBe(true);
  });

  it('deve calcular corretamente o número de meses de aluguel', () => {
    const startDate = new Date('2026-08-12T12:00:00Z');
    const expectedEndDate = new Date('2026-10-12T12:00:00Z'); // Exatamente 2 meses
    const payments = service.generatePaymentSchedule(startDate, 1000, PaymentFrequency.MONTHLY, expectedEndDate);
    
    expect(payments.length).toBe(2);
    expect(payments[0].dueDate.toISOString().startsWith('2026-09-12')).toBe(true);
    expect(payments[1].dueDate.toISOString().startsWith('2026-10-12')).toBe(true);
  });
  
  it('deve tratar semanas corretamente', () => {
    const startDate = new Date('2026-08-12T12:00:00Z');
    const expectedEndDate = new Date('2026-08-26T12:00:00Z'); // Exatamente 14 dias (2 semanas)
    const payments = service.generatePaymentSchedule(startDate, 1000, PaymentFrequency.WEEKLY, expectedEndDate);
    
    expect(payments.length).toBe(2);
    expect(payments[0].dueDate.toISOString().startsWith('2026-08-19')).toBe(true);
    expect(payments[1].dueDate.toISOString().startsWith('2026-08-26')).toBe(true);
  });
});
