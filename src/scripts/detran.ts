/**
 * Controle da consulta automática ao Detran (Infosimples). Tem custo por consulta, por isso
 * é ligada por locadora pela Frotly, e não pelo cliente.
 *
 * Em produção, dentro do container:
 *   node dist/src/scripts/detran.js status
 *       locadoras, veículos atendidos e gasto do mês
 *   node dist/src/scripts/detran.js enable  --tenant <id>
 *   node dist/src/scripts/detran.js disable --tenant <id>
 *   node dist/src/scripts/detran.js run --tenant <id> [--vehicle <id>] [--only fines,licensing,ipva] [--apply]
 *       sem --apply só lista o que seria consultado (nada é cobrado)
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/schemas/tenant.schema';
import { Vehicle } from '../vehicles/schemas/vehicle.schema';
import { DetranSyncService } from '../detran/detran-sync.service';
import { DetranService } from '../detran/providers/detran-provider';

function args() {
  const out: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  out._ = argv[0] ?? '';
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true;
    else {
      out[a.slice(2)] = next;
      i++;
    }
  }
  return out;
}

const fail = (msg: string): never => {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
};
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function main() {
  const a = args();
  const cmd = String(a._);
  if (!['status', 'enable', 'disable', 'run'].includes(cmd)) fail('Use: status | enable --tenant <id> | disable --tenant <id> | run --tenant <id> [--vehicle <id>] [--only fines,licensing,ipva] [--apply]');
  const tenantId = a.tenant ? String(a.tenant) : '';
  if (cmd !== 'status' && !Types.ObjectId.isValid(tenantId)) fail('Informe --tenant <id>.');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const tenantModel = app.get<Model<any>>(getModelToken(Tenant.name));
    const vehicleModel = app.get<Model<any>>(getModelToken(Vehicle.name));
    const sync = app.get(DetranSyncService);

    if (cmd === 'status') {
      const usage = await sync.usageThisMonth();
      console.log(`\nConsultas neste mês: ${usage.billable} cobradas de ${usage.limit} (teto) · ${usage.queries} no total · gasto ${money(usage.cost)}`);
      console.log(`UFs atendidas: ${sync.supportedUfs.join(', ')}\n`);
      for (const t of await tenantModel.find({}).select('name detranSyncEnabled cnpj').lean()) {
        const total = await vehicleModel.countDocuments({ tenantId: t._id });
        const supported = await vehicleModel.countDocuments({ tenantId: t._id, uf: { $in: sync.supportedUfs } });
        console.log(`${t.detranSyncEnabled ? '🟢' : '⚪'} ${t.name} (${t._id}) · ${supported} de ${total} veículo(s) em UF atendida${t.cnpj ? '' : ' · sem CNPJ'}`);
      }
      console.log('');
      return;
    }

    const tenant = await tenantModel.findById(tenantId).lean();
    if (!tenant) fail('Locadora não encontrada.');

    if (cmd === 'enable' || cmd === 'disable') {
      await tenantModel.updateOne({ _id: tenant._id }, { $set: { detranSyncEnabled: cmd === 'enable' } });
      console.log(`\n${cmd === 'enable' ? '🟢 Ligada' : '⚪ Desligada'} a consulta automática para ${tenant.name}.\n`);
      return;
    }

    const kinds = String(a.only || 'fines,licensing,ipva').split(',').map((s) => s.trim()) as DetranService[];
    if (kinds.some((k) => !['fines', 'licensing', 'ipva'].includes(k))) fail('--only aceita fines, licensing, ipva.');
    const filter: any = { tenantId: tenant._id, uf: { $in: sync.supportedUfs } };
    if (a.vehicle) filter._id = new Types.ObjectId(String(a.vehicle));
    const vehicles = await vehicleModel.find(filter).lean();
    if (!vehicles.length) fail('Nenhum veículo em UF atendida (preencha a UF no cadastro do veículo).');

    if (a.apply !== true) {
      console.log(`\nSimulação para ${tenant.name}: ${vehicles.length} veículo(s) × ${kinds.join(', ')}`);
      for (const v of vehicles) console.log(`  ${v.licensePlate} (${v.uf}) RENAVAM ${v.renavam}`);
      console.log(`\nAté ${vehicles.length * kinds.length} consulta(s), cerca de ${money(vehicles.length * kinds.length * 0.26)}. Rode com --apply para consultar.\n`);
      return;
    }

    for (const v of vehicles) {
      const res = await sync.syncVehicle(tenant, v, kinds, 'SCRIPT');
      console.log(`\n${res.plate}${res.skipped ? `: pulado (${res.skipped})` : ''}`);
      for (const r of res.results) {
        console.log(`  ${r.kind}: ${r.skipped ? `pulado (${r.skipped})` : r.ok ? 'ok' : `erro: ${r.message}`}${r.summary ? ` ${JSON.stringify(r.summary)}` : ''}`);
      }
    }
    const usage = await sync.usageThisMonth();
    console.log(`\nGasto no mês: ${money(usage.cost)} (${usage.billable}/${usage.limit} consultas cobradas).\n`);
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => fail(e?.message ?? String(e)));
