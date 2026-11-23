/**
 * Cadastra um cliente novo (locadora) feito pela Frotly: cria a locadora e o primeiro
 * administrador como convite, e manda o e-mail de boas-vindas com o link para criar a
 * senha (7 dias). Ao criar a senha, a pessoa já entra no app.
 *
 * Sem --apply só mostra o que faria (nada é gravado nem enviado).
 *
 * Em produção, dentro do container:
 *   docker compose exec backend node dist/src/scripts/onboard-client.js \
 *     --name "Start2 Locadora" [--cnpj 12345678000199] --email financeiro@start2.com.br \
 *     --admin-name "Financeiro Start2" --plan PRO --trial-days 7 [--apply]
 *
 * --trial-days 0 = sem período de teste (cobrança combinada fora do app).
 * --cnpj é opcional: sem ele, o cliente preenche depois em Configurações.
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Tenant, TenantDocument, PlanType } from '../tenants/schemas/tenant.schema';
import { User, UserDocument, UserRole } from '../auth/schemas/user.schema';
import { TenantsService } from '../tenants/tenants.service';
import { TrialService } from '../billing/trial.service';
import { UsersService } from '../users/users.service';

function args() {
  const out: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

async function main() {
  const a = args();
  const name = String(a.name ?? '').trim();
  const cnpj = String(a.cnpj ?? '').replace(/\D/g, '');
  const email = String(a.email ?? '').trim().toLowerCase();
  const adminName = String(a['admin-name'] ?? '').trim();
  const plan = String(a.plan ?? '').toUpperCase() as PlanType;
  const trialDays = a['trial-days'] === undefined ? 7 : Number(a['trial-days']);
  const apply = a.apply === true;

  if (!name) fail('Informe --name (nome da locadora).');
  if (cnpj && cnpj.length !== 14) fail('--cnpj deve ter 14 dígitos (ou deixe de fora para preencher depois).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Informe --email válido.');
  if (!adminName) fail('Informe --admin-name (nome de quem vai receber o acesso).');
  if (!Object.values(PlanType).includes(plan)) fail(`Informe --plan: ${Object.values(PlanType).join(', ')}.`);
  if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 60) fail('--trial-days deve ser um número de 0 a 60.');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const tenantModel = app.get<Model<TenantDocument>>(getModelToken(Tenant.name));
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

    if (cnpj) {
      const sameCnpj = await tenantModel.findOne({ cnpj: { $in: [cnpj, cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')] } }).select('name').lean();
      if (sameCnpj) fail(`Já existe uma locadora com esse CNPJ: ${sameCnpj.name} (${sameCnpj._id}). Para dar acesso a mais alguém lá, use o painel de Usuários.`);
    } else {
      // O índice único de CNPJ aceita só uma locadora sem CNPJ por vez.
      const noCnpj = await tenantModel.findOne({ $or: [{ cnpj: { $exists: false } }, { cnpj: null }, { cnpj: '' }] } as any).select('name').lean();
      if (noCnpj) fail(`Já existe uma locadora sem CNPJ (${noCnpj.name}, ${noCnpj._id}). Preencha o CNPJ dela antes ou informe --cnpj.`);
    }
    const sameName = await tenantModel.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).select('name').lean();
    if (sameName) fail(`Já existe uma locadora com esse nome: ${sameName.name} (${sameName._id}).`);
    const elsewhere = await userModel.find({ email }).select('tenantId').lean();

    console.log('\nCliente novo');
    console.log(`  Locadora:   ${name}`);
    console.log(`  CNPJ:       ${cnpj || '(não informado, o cliente preenche em Configurações)'}`);
    console.log(`  Plano:      ${plan}`);
    console.log(`  Teste:      ${trialDays ? `${trialDays} dias` : 'sem período de teste'}`);
    console.log(`  Admin:      ${adminName} <${email}> (Administrador, convite por e-mail)`);
    if (elsewhere.length) console.log(`  Aviso:      esse e-mail já tem acesso a ${elsewhere.length} outra(s) locadora(s); no login ele vai escolher qual.`);

    if (!apply) {
      console.log('\nSimulação: nada foi gravado nem enviado. Rode de novo com --apply para cadastrar.\n');
      return;
    }

    const tenantsService = app.get(TenantsService);
    const trialService = app.get(TrialService);
    const usersService = app.get(UsersService);

    const tenant: any = await tenantsService.create({ name, ...(cnpj ? { cnpj } : {}), contactEmail: email, plan } as any);
    const tenantId = String(tenant._id);
    try {
      if (trialDays > 0) {
        await trialService.initiateTrial(tenantId, plan);
        if (trialDays !== 7) {
          await tenantModel.updateOne({ _id: tenant._id }, { $set: { trialEndDate: new Date(Date.now() + trialDays * 86_400_000) } });
        }
      } else {
        await tenantModel.updateOne({ _id: tenant._id }, { $set: { isTrialActive: false } });
      }
      const res = await usersService.createInvited(tenantId, { name: adminName, email, role: UserRole.ADMIN });

      console.log(`\n✅ Cadastrado. Locadora ${tenantId} (subdomínio ${tenant.subdomain}).`);
      if (res.emailSent) {
        console.log(`✅ E-mail de boas-vindas enviado para ${email}.\n`);
      } else {
        console.log(`⚠️  O e-mail NÃO foi enviado (veja o erro do Resend acima). Mande este link para a pessoa (vale 7 dias):\n   ${res.inviteLink}\n`);
      }
    } catch (err) {
      // Desfaz a locadora para poder rodar de novo sem conflito de CNPJ.
      await userModel.deleteMany({ tenantId: tenant._id });
      await tenantModel.deleteOne({ _id: tenant._id });
      throw err;
    }
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => fail(e?.message ?? String(e)));
