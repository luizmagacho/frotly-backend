import { mapRjFines, mapRjIpva, mapRjLicensing } from './rj.provider';
import { parseDate, parseMoney } from './detran-provider';

describe('Detran-RJ (Infosimples) — leitura das respostas', () => {
  it('parseMoney e parseDate entendem formato brasileiro e normalizado', () => {
    expect(parseMoney('R$ 1.234,56')).toBe(1234.56);
    expect(parseMoney('293.47')).toBe(293.47);
    expect(parseMoney(130.16)).toBe(130.16);
    expect(parseMoney('')).toBeUndefined();
    expect(parseDate('05/03/2026')?.toISOString()).toBe('2026-03-05T12:00:00.000Z');
    expect(parseDate('2026-03-05')?.toISOString()).toBe('2026-03-05T12:00:00.000Z');
    expect(parseDate('05/03/2026', '14:30')?.toISOString()).toBe('2026-03-05T17:30:00.000Z');
    expect(parseDate('31/13/2026')).toBeUndefined();
  });

  it('mapRjFines lê as multas, separa pagas e ignora linhas incompletas', () => {
    const fines = mapRjFines([
      {
        renavam: '01234567890',
        multas: [
          {
            auto_de_infracao: 'E12345678',
            data_infracao: '10/09/2026',
            hora: '08:15',
            descricao: 'Transitar em velocidade superior à máxima permitida em até 20%',
            enquadramento_da_infracao: '745-50',
            local_da_infracao: 'Av. Brasil, 1000 - Rio de Janeiro',
            orgao_emissor: 'DETRAN-RJ',
            status_de_pagamento: 'Não pago',
            valor_a_ser_pago: 'R$ 104,12',
            valor_original: 'R$ 130,16',
            data_pagamento_com_desconto: '20/10/2026',
          },
          { auto_de_infracao: 'E999', data_infracao: '01/02/2026', descricao: 'Estacionar em local proibido', status_de_pagamento: 'Pago', valor_original: 'R$ 195,23' },
          { auto_de_infracao: '', data_infracao: '01/02/2026', valor_original: 'R$ 10,00' },
        ],
      },
    ]);
    expect(fines).toHaveLength(2);
    expect(fines[0]).toMatchObject({
      noticeNumber: 'E12345678',
      description: 'Transitar em velocidade superior à máxima permitida em até 20%',
      infractionCode: '745-50',
      issuingAgency: 'DETRAN-RJ',
      value: 104.12,
      paid: false,
    });
    expect(fines[0].infractionDate.toISOString()).toBe('2026-09-10T11:15:00.000Z');
    expect(fines[0].dueDate?.toISOString()).toBe('2026-10-20T12:00:00.000Z');
    expect(fines[1]).toMatchObject({ noticeNumber: 'E999', value: 195.23, paid: true });
  });

  it('mapRjLicensing soma as cotas de cada exercício em aberto', () => {
    const debts = mapRjLicensing([
      {
        exercicios: [
          { exercicio: '2026', cotas: [{ descricao: 'Taxa de licenciamento', valor: 'R$ 233,86', vencimento: '30/06/2026' }, { descricao: 'Taxa', valor: 'R$ 10,00', vencimento: '30/05/2026' }] },
          { exercicio: '2025', cotas: [] },
        ],
      },
    ]);
    expect(debts).toEqual([{ year: 2026, value: 243.86, dueDate: new Date('2026-05-30T12:00:00.000Z') }]);
  });

  it('mapRjIpva separa a cota única (desconto) das parcelas', () => {
    const ipva = mapRjIpva(
      [
        {
          cotas: [
            { cota: 'Cota Única', data_vencimento: '20/01/2027', valor_a_pagar: 'R$ 1.900,00' },
            { cota: '1ª Cota', data_vencimento: '20/01/2027', valor_a_pagar: 'R$ 666,67' },
            { cota: '2ª Cota', data_vencimento: '20/02/2027', valor_a_pagar: 'R$ 666,67' },
            { cota: '3ª Cota', data_vencimento: '20/03/2027', valor_a_pagar: 'R$ 666,66' },
          ],
        },
      ],
      2027,
    );
    expect(ipva?.quotas.map((q) => [q.number, q.amount])).toEqual([[1, 666.67], [2, 666.67], [3, 666.66]]);
    expect(ipva?.singleQuotaAmount).toBe(1900);
    expect(mapRjIpva([{ cotas: [] }], 2027)).toBeNull();
  });
});
