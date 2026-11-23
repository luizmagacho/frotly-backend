import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { SalePlanService } from './sale-plan.service';
import { ReportsService } from './reports.service';
import { FipeService } from '../fipe/fipe.service';
import { LlmService } from '../llm/llm.service';
import { Vehicle } from '../vehicles/schemas/vehicle.schema';
import { Rental, PaymentFrequency } from '../rentals/schemas/rental.schema';
import { FinancialEntry } from '../financial-entries/schemas/financial-entry.schema';

const DAY = 864e5;

describe('SalePlanService', () => {
  describe('regras de cálculo', () => {
    it('desvalorização mensal pelo histórico da FIPE', () => {
      // 12 meses: 100k -> ~88.6k  = ~1%/mês
      const history = Array.from({ length: 13 }, (_, i) => ({ price: Math.round(88_638 * Math.pow(1.01, i)) }));
      expect(SalePlanService.monthlyDepreciation(history)).toBeCloseTo(0.01, 3);
      expect(SalePlanService.monthlyDepreciation([{ price: 1 }])).toBe(0.008); // histórico curto = padrão
    });

    it('desconto por km: nunca acima da FIPE, cresce com km e soma a barreira dos 100 mil', () => {
      expect(SalePlanService.kmDiscount(20_000, 3)).toBe(0); // rodou pouco: não valoriza acima da FIPE
      const at90 = SalePlanService.kmDiscount(90_000, 3);
      const at100 = SalePlanService.kmDiscount(100_000, 3);
      expect(at90).toBeGreaterThan(0);
      expect(at100 - at90).toBeGreaterThan(0.05); // 10 mil km a mais + barreira
      expect(SalePlanService.kmDiscount(400_000, 1)).toBeLessThanOrEqual(0.3);
    });

    it('aluguel semanal pela periodicidade', () => {
      expect(SalePlanService.weeklyRent(700, PaymentFrequency.WEEKLY)).toBe(700);
      expect(SalePlanService.weeklyRent(1400, PaymentFrequency.BIWEEKLY)).toBe(700);
      expect(SalePlanService.weeklyRent(3033, PaymentFrequency.MONTHLY)).toBeCloseTo(700, 0);
    });
  });

  describe('getPlan', () => {
    const vehicleId = new Types.ObjectId();
    let service: SalePlanService;
    let llm: { isConfigured: jest.Mock; completeJson: jest.Mock };
    let vehicle: any;
    let rental: any;
    let readings: { date: Date; mileage: number }[];
    const fipe = {
      quote: jest.fn().mockResolvedValue({
        fipeCode: '001506-7', brand: 'Fiat', model: 'CRONOS 1.3', modelYear: 2023, fuel: 'Flex',
        price: 70_000, referenceMonth: 'novembro de 2026',
        history: Array.from({ length: 13 }, (_, i) => ({ price: Math.round(70_000 * Math.pow(1.008, i)), month: `m${i}` })),
      }),
    };

    beforeEach(async () => {
      vehicle = { _id: vehicleId, licensePlate: 'ABC1D23', brand: 'Fiat', model: 'Cronos', modelYear: 2023, mileage: 80_000, fipeCode: '001506-7', fipeYearCode: '2023-5' };
      rental = { rentalAmount: 700, paymentFrequency: PaymentFrequency.WEEKLY, weeklyKmLimit: 1500 };
      // 1.000 km/semana nos últimos 90 dias
      readings = Array.from({ length: 14 }, (_, i) => ({ date: new Date(Date.now() - (91 - i * 7) * DAY), mileage: 67_000 + i * 1000 }));
      llm = { isConfigured: jest.fn().mockReturnValue(false), completeJson: jest.fn() };

      const lean = (v: any) => ({ lean: () => Promise.resolve(v), select: () => ({ lean: () => Promise.resolve(v) }) });
      const moduleRef = await Test.createTestingModule({
        providers: [
          SalePlanService,
          { provide: getModelToken(Vehicle.name), useValue: { findById: () => lean(vehicle) } },
          { provide: getModelToken(Rental.name), useValue: { findOne: () => lean(rental) } },
          { provide: getModelToken(FinancialEntry.name), useValue: { aggregate: jest.fn().mockResolvedValue([{ total: 2600 }]) } },
          { provide: FipeService, useValue: fipe },
          { provide: LlmService, useValue: llm },
          { provide: ReportsService, useValue: { collectReadings: async () => new Map([[String(vehicleId), readings]]) } },
        ],
      }).compile();
      service = moduleRef.get(SalePlanService);
    });

    it('pede a FIPE quando o veículo não tem código', async () => {
      vehicle.fipeCode = undefined;
      const r: any = await service.getPlan(String(vehicleId), 't1');
      expect(r.needsFipe).toBe(true);
      expect(fipe.quote).not.toHaveBeenCalled();
    });

    it('carro lucrativo: recomenda vender um mês antes dos 100 mil km (texto por regras sem IA)', async () => {
      const r: any = await service.getPlan(String(vehicleId), 't2');
      expect(r.kmPerWeek).toBe(1011); // 13.000 km em 90 dias
      expect(r.weeksTo100k).toBe(20);
      expect(r.recommended.reason).toBe('antes_100k');
      expect(r.recommended.km).toBeLessThan(100_000);
      expect(r.estimatedSaleValueNow).toBeLessThanOrEqual(70_000);
      expect(r.aiSource).toBe('regras');
      expect(r.ai.recomendacao).toContain('100 mil km');
    });

    it('usa o texto da IA quando disponível e cai para regras se ela falhar', async () => {
      llm.isConfigured.mockReturnValue(true);
      llm.completeJson.mockResolvedValueOnce({ resumo: 'R', recomendacao: 'Vender em abril', pontos: ['a', 'b', 'c', 'd', 'e', 'f'] });
      const ok: any = await service.getPlan(String(vehicleId), 't3');
      expect(ok.aiSource).toBe('llm');
      expect(ok.ai.pontos).toHaveLength(5);
      const facts = JSON.parse(llm.completeJson.mock.calls[0][1]);
      expect(facts.momento_recomendado).toContain('100 mil km');

      llm.completeJson.mockRejectedValueOnce(new Error('429'));
      const fallback: any = await service.getPlan(String(vehicleId), 't4');
      expect(fallback.aiSource).toBe('regras');
    });

    it('carro que dá prejuízo: vender agora', async () => {
      rental.rentalAmount = 100; // aluguel não cobre custos + desvalorização
      const r: any = await service.getPlan(String(vehicleId), 't5');
      expect(r.recommended.reason).toBe('agora');
    });
  });
});
