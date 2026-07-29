import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';

export interface WhatsAppPayload {
  to: string;
  message: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private client: Twilio.Twilio;
  private readonly fromNumber: string;

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886');

    if (accountSid && authToken) {
      this.client = Twilio(accountSid, authToken);
    } else {
      this.logger.warn('Twilio credentials not configured — WhatsApp notifications disabled.');
    }
  }

  async send(payload: WhatsAppPayload): Promise<void> {
    if (!this.client) {
      this.logger.warn(`WhatsApp [MOCK] to ${payload.to}: ${payload.message}`);
      return;
    }

    try {
      const toFormatted = payload.to.startsWith('whatsapp:')
        ? payload.to
        : `whatsapp:+55${payload.to.replace(/\D/g, '')}`;

      await this.client.messages.create({
        from: this.fromNumber,
        to: toFormatted,
        body: payload.message,
      });

      this.logger.log(`WhatsApp enviado para: ${payload.to}`);
    } catch (error) {
      this.logger.error(`Falha ao enviar WhatsApp: ${error.message}`);
      throw error;
    }
  }

  async sendPaymentOverdueAlert(driverName: string, phone: string, plate: string, amount: number): Promise<void> {
    await this.send({
      to: phone,
      message: `⚠️ *Frotly* — Olá, ${driverName}!\n\nSeu pagamento de *R$ ${amount.toFixed(2)}* referente ao veículo *${plate}* está atrasado.\n\nRegularize sua situação para evitar suspensão do contrato.\n\nDúvidas? Responda esta mensagem. 🚗`,
    });
  }

  async sendLicenseExpirationWarning(driverName: string, phone: string, daysLeft: number): Promise<void> {
    await this.send({
      to: phone,
      message: `🔔 *Frotly* — Olá, ${driverName}!\n\nSua CNH vence em *${daysLeft} dias*.\n\nNão esqueça de renová-la para continuar operando normalmente! ✅`,
    });
  }

  async sendDocumentExpirationAlert(phone: string, plate: string, documentType: string, daysLeft: number): Promise<void> {
    const labels: Record<string, string> = {
      ipva: 'IPVA',
      licensing: 'Licenciamento',
      insurance: 'Seguro',
    };

    await this.send({
      to: phone,
      message: `📋 *Frotly* — O *${labels[documentType] ?? documentType}* do veículo *${plate}* vence em *${daysLeft} dias*.\n\nProvidencie a regularização. 🛡️`,
    });
  }

  async sendFineAlert(phone: string, plate: string, description: string, amount: number): Promise<void> {
    await this.send({
      to: phone,
      message: `🚨 *Frotly* — Nova multa detectada no veículo *${plate}*!\n\n*Infração:* ${description}\n*Valor:* R$ ${amount.toFixed(2)}\n\nVerifique no aplicativo para mais detalhes.`,
    });
  }

  async sendPaymentUpcomingWarning(driverName: string, phone: string, plate: string, amount: number, dueDate: Date): Promise<void> {
    await this.send({
      to: phone,
      message: `⏳ *Frotly* — Olá, ${driverName}!\n\nLembrete amigável: sua parcela de *R$ ${amount.toFixed(2)}* do veículo *${plate}* vence em *${new Date(dueDate).toLocaleDateString('pt-BR')}*.\n\nEvite atrasos! 🚗`,
    });
  }

  async sendMileageUpdateReminder(driverName: string, phone: string, plate: string): Promise<void> {
    await this.send({
      to: phone,
      message: `🚗 *Frotly* — Olá, ${driverName}!\n\nSeu contrato do veículo *${plate}* fechou mais um ciclo de 30 dias!\n\nPor favor, informe a *quilometragem atual* do painel do carro para atualizarmos o sistema. ✅`,
    });
  }

  async sendRentalReturnReminder(driverName: string, phone: string, plate: string, returnDate: Date): Promise<void> {
    await this.send({
      to: phone,
      message: `📅 *Frotly* — Olá, ${driverName}!\n\nEste é um lembrete de que a devolução do veículo *${plate}* está prevista para *${new Date(returnDate).toLocaleDateString('pt-BR')}*.\n\nCertifique-se de entregar o veículo na data combinada para evitar cobranças adicionais. 🚗\n\nDúvidas? Responda esta mensagem.`,
    });
  }

  async sendWelcomeMessage(name: string, phone: string): Promise<void> {
    await this.send({
      to: phone,
      message: `🎉 *Frotly* — Bem-vindo(a), ${name}!\n\nSeu contrato foi criado com sucesso e você já faz parte da nossa frota.\n\nQualquer dúvida sobre seu veículo, pagamentos ou contrato, estamos aqui para ajudar. Boas viagens! 🚗✨`,
    });
  }
}
