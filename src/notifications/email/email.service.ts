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

  /** Retorna true se o provedor aceitou o envio. Erros são logados e não derrubam o fluxo. */
  async send(payload: EmailPayload): Promise<boolean> {
    try {
      const from = `"Frotly" <${this.configService.get('SMTP_FROM', 'noreply@gestorfrota.com.br')}>`;
      
      const res: any = await this.resend.emails.send({
        from,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      if (res?.error) throw new Error(res.error.message || 'Resend recusou o envio');

      this.logger.log(`E-mail enviado via Resend para: ${payload.to}`);
      return true;
    } catch (error) {
      // Loga o erro mas não derruba o fluxo principal conforme padrão do cliente
      this.logger.error(`Falha ao enviar e-mail via Resend: ${error.message}`, error.stack);
      return false;
    }
  }

  async sendPaymentOverdue(driverName: string, driverEmail: string, plate: string, amount: number, daysOverdue: number): Promise<void> {
    await this.send({
      to: driverEmail,
      subject: `⚠️ Pagamento Atrasado - Veículo ${plate}`,
      html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 40px auto; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="background: #0f172a; padding: 30px 20px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #3b82f6;">
            <img src="https://frotly.com.br/logo.jpg" alt="Frotly" style="height: 48px; border-radius: 10px; margin-bottom: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Frotly</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px;">
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
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 40px auto; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="background: #0f172a; padding: 30px 20px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #3b82f6;">
            <img src="https://frotly.com.br/logo.jpg" alt="Frotly" style="height: 48px; border-radius: 10px; margin-bottom: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Frotly</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px;">
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
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 40px auto; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="background: #0f172a; padding: 30px 20px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #3b82f6;">
            <img src="https://frotly.com.br/logo.jpg" alt="Frotly" style="height: 48px; border-radius: 10px; margin-bottom: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Frotly</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px;">
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
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 40px auto; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="background: #0f172a; padding: 30px 20px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #3b82f6;">
            <img src="https://frotly.com.br/logo.jpg" alt="Frotly" style="height: 48px; border-radius: 10px; margin-bottom: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Frotly</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px;">
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
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 40px auto; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="background: #0f172a; padding: 30px 20px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #3b82f6;">
            <img src="https://frotly.com.br/logo.jpg" alt="Frotly" style="height: 48px; border-radius: 10px; margin-bottom: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Frotly</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px;">
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
      subject: `🔒 Recuperação de Senha - Frotly`,
      html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 40px auto; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="background: #0f172a; padding: 30px 20px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #3b82f6;">
            <img src="https://frotly.com.br/logo.jpg" alt="Frotly" style="height: 48px; border-radius: 10px; margin-bottom: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Frotly</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px;">
            <p>Olá, <strong>${name}</strong>!</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
            <p>Clique no botão abaixo para criar uma nova senha. Este link é válido por 1 hora.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${resetLink}" style="background-color: #2563EB; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">Redefinir Minha Senha</a>
            </div>
            <p style="font-size: 12px; color: #666;">Se você não solicitou a redefinição, por favor ignore este e-mail.</p>
          </div>
        </div>
      `,
    });
  }

  /** Convite de um novo usuário da locadora: boas-vindas + link para criar a senha (válido por 7 dias). */
  async sendWelcomeInvite(opts: { name: string; email: string; link: string; tenantName: string; inviterName?: string; roleLabel: string }): Promise<boolean> {
    const esc = (v: string) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
    const name = esc(opts.name.split(' ')[0] || opts.name);
    const tenant = esc(opts.tenantName);
    const inviter = opts.inviterName ? esc(opts.inviterName) : null;
    const link = esc(opts.link);
    const step = (n: number, title: string, text: string) => `
      <tr><td style="padding:0 0 14px;vertical-align:top;width:36px;">
        <div style="width:26px;height:26px;border-radius:13px;background:#fde8e9;color:#D12027;font-weight:700;font-size:13px;line-height:26px;text-align:center;">${n}</div>
      </td><td style="padding:0 0 14px;vertical-align:top;">
        <div style="font-weight:600;color:#0f172a;font-size:14px;">${title}</div>
        <div style="color:#64748b;font-size:13px;line-height:1.5;">${text}</div>
      </td></tr>`;

    return this.send({
      to: opts.email,
      subject: `Bem-vindo(a) ao Frotly, ${opts.name.split(' ')[0] || opts.name}! Crie sua senha`,
      text: `Olá, ${opts.name}! ${opts.inviterName ? opts.inviterName + ' convidou você' : 'Você foi convidado(a)'} para acessar a ${opts.tenantName} no Frotly (${opts.roleLabel}). Crie sua senha em: ${opts.link} (o link vale por 7 dias).`,
      html: `
<div style="background:#f1f5f9;padding:32px 12px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td style="background:#0f172a;padding:28px 32px;border-bottom:4px solid #D12027;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td><img src="https://frotly.com.br/logo.jpg" alt="Frotly" width="40" height="40" style="display:block;border-radius:10px;"></td>
        <td style="padding-left:12px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Frotly</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:36px 32px 8px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#D12027;">Boas-vindas</div>
      <h1 style="margin:8px 0 12px;font-size:24px;line-height:1.3;color:#0f172a;">Olá, ${name}! Seu acesso está pronto.</h1>
      <p style="margin:0 0 8px;color:#334155;font-size:15px;line-height:1.6;">
        ${inviter ? `<strong>${inviter}</strong> convidou você` : 'Você foi convidado(a)'} para acessar a <strong>${tenant}</strong> no Frotly, o sistema de gestão da frota.
      </p>
      <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">Seu perfil de acesso: <strong>${esc(opts.roleLabel)}</strong>.</p>
    </td></tr>
    <tr><td style="padding:28px 32px;text-align:center;">
      <a href="${link}" style="display:inline-block;background:#D12027;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 34px;border-radius:10px;">Criar minha senha</a>
      <div style="margin-top:10px;color:#94a3b8;font-size:12px;">O link vale por 7 dias. Depois de criar a senha você já entra no sistema.</div>
    </td></tr>
    <tr><td style="padding:4px 32px 20px;">
      <div style="border-top:1px solid #e2e8f0;padding-top:22px;">
        <div style="font-weight:700;color:#0f172a;font-size:15px;margin-bottom:14px;">Primeiros passos</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${step(1, 'Crie sua senha', 'Use o botão acima. Você entra direto no painel.')}
          ${step(2, 'Veja a frota', 'Veículos, motoristas, aluguéis e pagamentos em um só lugar.')}
          ${step(3, 'Acompanhe os vencimentos', 'IPVA, licenciamento, multas e manutenções com alertas.')}
        </table>
      </div>
    </td></tr>
    <tr><td style="padding:0 32px 28px;">
      <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;color:#64748b;font-size:12px;line-height:1.6;">
        Se o botão não funcionar, copie e cole este endereço no navegador:<br>
        <a href="${link}" style="color:#D12027;word-break:break-all;">${link}</a>
      </div>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:18px 32px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;">
      Não esperava este convite? Pode ignorar este e-mail.<br>Frotly · frotly.com.br
    </td></tr>
  </table>
</div>`,
    });
  }
}
