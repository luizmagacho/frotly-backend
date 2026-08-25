import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get('RESEND_API_KEY'));
  }

  async send(payload: EmailPayload): Promise<void> {
    try {
      const from = `"GestorFrota PR" <${this.configService.get('SMTP_FROM', 'noreply@gestorfrota.com.br')}>`;
      
      await this.resend.emails.send({
        from,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      
      this.logger.log(`E-mail enviado via Resend para: ${payload.to}`);
    } catch (error) {
      // Loga o erro mas não derruba o fluxo principal conforme padrão do cliente
      this.logger.error(`Falha ao enviar e-mail via Resend: ${error.message}`, error.stack);
    }
  }

  async sendPaymentOverdue(driverName: string, driverEmail: string, plate: string, amount: number, daysOverdue: number): Promise<void> {
    await this.send({
      to: driverEmail,
      subject: `⚠️ Pagamento Atrasado - Veículo ${plate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #D12027; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">GestorFrota PR</h1>
          </div>
          <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px;">
            <p>Olá, <strong>${driverName}</strong>!</p>
            <p>Identificamos um pagamento em atraso de <strong>R$ ${amount.toFixed(2)}</strong> referente ao aluguel do veículo <strong>${plate}</strong>.</p>
            <p>Atraso: <strong>${daysOverdue} dias</strong></p>
            <div style="background: #fff3cd; padding: 16px; border-radius: 6px; border-left: 4px solid #D12027; margin: 16px 0;">
              <strong>Regularize sua situação o quanto antes para evitar suspensão do contrato.</strong>
            </div>
            <p>Entre em contato conosco pelo WhatsApp ou telefone para mais informações.</p>
          </div>
        </div>
      `,
    });
  }

  async sendLicenseExpirationWarning(driverName: string, driverEmail: string, daysLeft: number): Promise<void> {
    await this.send({
      to: driverEmail,
      subject: `🔔 CNH vencendo em ${daysLeft} dias`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #D12027; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">GestorFrota PR</h1>
          </div>
          <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px;">
            <p>Olá, <strong>${driverName}</strong>!</p>
            <p>Sua CNH vence em <strong>${daysLeft} dias</strong>. Não esqueça de renová-la!</p>
            <p>Motoristas com CNH vencida não podem operar veículos da frota.</p>
          </div>
        </div>
      `,
    });
  }

  async sendDocumentExpirationAlert(email: string, plate: string, documentType: string, daysLeft: number): Promise<void> {
    const labels: Record<string, string> = {
      ipva: 'IPVA',
      licensing: 'Licenciamento',
      insurance: 'Seguro',
    };

    await this.send({
      to: email,
      subject: `📋 ${labels[documentType] ?? documentType} do veículo ${plate} vencendo em ${daysLeft} dias`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #D12027; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">GestorFrota PR</h1>
          </div>
          <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px;">
            <p>Atenção! O <strong>${labels[documentType]}</strong> do veículo <strong>${plate}</strong> vence em <strong>${daysLeft} dias</strong>.</p>
            <p>Providencie a regularização para evitar problemas legais.</p>
          </div>
        </div>
      `,
    });
  }

  async sendPaymentUpcomingWarning(driverName: string, driverEmail: string, plate: string, amount: number, dueDate: Date): Promise<void> {
    await this.send({
      to: driverEmail,
      subject: `⏳ Lembrete de Vencimento - Veículo ${plate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #2563EB; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">GestorFrota PR</h1>
          </div>
          <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px;">
            <p>Olá, <strong>${driverName}</strong>!</p>
            <p>Este é um lembrete amigável de que a sua próxima parcela de aluguel do veículo <strong>${plate}</strong> no valor de <strong>R$ ${amount.toFixed(2)}</strong> vence em breve.</p>
            <p>Data de Vencimento: <strong>${new Date(dueDate).toLocaleDateString('pt-BR')}</strong></p>
            <p>Por favor, realize o pagamento no prazo para evitar cobranças adicionais.</p>
          </div>
        </div>
      `,
    });
  }

  async sendMileageUpdateReminder(driverName: string, driverEmail: string, plate: string): Promise<void> {
    await this.send({
      to: driverEmail,
      subject: `🚗 Atualização Mensal de Quilometragem - Veículo ${plate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #10B981; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">GestorFrota PR</h1>
          </div>
          <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px;">
            <p>Olá, <strong>${driverName}</strong>!</p>
            <p>O seu contrato de locação do veículo <strong>${plate}</strong> completou mais um ciclo de 30 dias!</p>
            <p>Por favor, informe a quilometragem atual do veículo para mantermos o histórico em dia.</p>
          </div>
        </div>
      `,
    });
  }

  async sendPasswordResetEmail(name: string, email: string, token: string): Promise<void> {
    // Determine the frontend URL from config, defaulting if missing
    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    const resetLink = `${frontendUrl}/recuperar-senha?token=${token}`;
    
    await this.send({
      to: email,
      subject: `🔒 Recuperação de Senha - GestorFrota PR`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #2563EB; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">GestorFrota PR</h1>
          </div>
          <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px;">
            <p>Olá, <strong>${name}</strong>!</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
            <p>Clique no botão abaixo para criar uma nova senha. Este link é válido por 1 hora.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${resetLink}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Redefinir Minha Senha</a>
            </div>
            <p style="font-size: 12px; color: #666;">Se você não solicitou a redefinição, por favor ignore este e-mail.</p>
          </div>
        </div>
      `,
    });
  }
}
