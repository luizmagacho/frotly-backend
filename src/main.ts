import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

// Nomes de campo amigáveis para erros de chave duplicada do MongoDB (código 11000).
const DUPLICATE_KEY_FIELD_MESSAGES: Record<string, string> = {
  email: 'Este e-mail já está em uso. Faça login ou utilize outro e-mail.',
  cnpj: 'Já existe uma locadora cadastrada com este CNPJ.',
  subdomain: 'Este subdomínio já está em uso. Escolha outro nome para a locadora.',
};

/** Extrai o nome do campo duplicado da mensagem bruta do driver do MongoDB (ex.: "index: email_1 dup key: ..."). */
function friendlyDuplicateKeyMessage(rawMessage: string): string {
  const indexMatch = rawMessage.match(/index:\s*([a-zA-Z0-9_]+?)(?:_\d+)?\s*dup key/);
  const field = indexMatch?.[1];
  return (field && DUPLICATE_KEY_FIELD_MESSAGES[field]) ?? 'Já existe um registro com esses dados.';
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const isDuplicateKeyError = !(exception instanceof HttpException) && (exception as any)?.code === 11000;

    const status = isDuplicateKeyError
      ? HttpStatus.CONFLICT
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let rawMessage = exception instanceof Error ? exception.message : 'Unknown error';

    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      if (typeof resp === 'object' && resp !== null && 'message' in resp) {
        rawMessage = (resp as any).message;
      }
    }

    const message = isDuplicateKeyError ? friendlyDuplicateKeyMessage(exception instanceof Error ? exception.message : 'Unknown error') : rawMessage;
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      const stack = exception instanceof Error ? exception.stack : '';
      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message,
        stack,
      });
    } else {
      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message,
      });
    }
  }
}

async function bootstrap() {
  // rawBody: true keeps req.rawBody available alongside the normal parsed
  // req.body — the Stripe webhook needs the exact raw bytes to verify its signature.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Security headers. CSP is disabled because Swagger UI (served from this same
  // app at /api/docs) needs inline scripts/styles that a default policy blocks.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Global exceptions filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('GestorFrota PR — API')
    .setDescription('API de gestão de frota de veículos para motoristas de aplicativo no Paraná')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Autenticação')
    .addTag('Motoristas')
    .addTag('Veículos')
    .addTag('Aluguéis')
    .addTag('Manutenções')
    .addTag('Detran PR')
    .addTag('Notificações')
    .addTag('Histórico')
    .addTag('Relatórios')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 GestorFrota PR API rodando em: http://localhost:${port}/api`);
  console.log(`📖 Swagger disponível em: http://localhost:${port}/api/docs`);
}
bootstrap();
