import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TrialService } from '../src/billing/trial.service';

/** Dispara manualmente o job de cobrança de trials expirados (mesmo código do cron). */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const trialService = app.get(TrialService);

  console.log('Executando chargeExpiredTrials()...');
  await trialService.chargeExpiredTrials();
  console.log('Concluído.');

  await app.close();
}

bootstrap().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
