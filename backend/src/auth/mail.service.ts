import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private transporter: nodemailer.Transporter

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'relay.sena.edu.co'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.config.get<string>('SMTP_USER', 'sep@sena.edu.co'),
        pass: this.config.get<string>('SMTP_PASS', ''),
      },
      tls: { rejectUnauthorized: false },
    })
  }

  async enviarRestablecimiento(email: string, token: string): Promise<void> {
    const baseUrl = this.config.get<string>('APP_URL', 'https://sep.sena.edu.co')
    const link = `${baseUrl}/restablecer-contrasena?token=${token}`

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);max-width:600px;width:100%">

        <!-- Cabecera SENA -->
        <tr>
          <td style="background:#00304D;padding:28px 32px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:.5px">SEP</p>
                  <p style="margin:4px 0 0;color:rgba(255,255,255,.65);font-size:12px">Sistema Especializado de Proyectos · GGPC SENA</p>
                </td>
                <td align="right" style="vertical-align:middle">
                  <img src="${baseUrl}/images/sena-logo.svg" alt="SENA" width="64" height="64"
                       style="display:block;border:0;filter:brightness(0) invert(1)" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Barra verde -->
        <tr><td style="height:4px;background:linear-gradient(90deg,#39A900,#00304D)"></td></tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding:36px 32px 24px">
            <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#00304D">Restablecer contraseña</p>
            <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6">
              Recibimos una solicitud para restablecer la contraseña de la cuenta asociada a <strong>${email}</strong>.
              Si usted no realizó esta solicitud, puede ignorar este mensaje.
            </p>

            <p style="margin:0 0 16px;font-size:14px;color:#555">
              Haga clic en el botón para crear una nueva contraseña. Este enlace es válido por <strong>30 minutos</strong>.
            </p>

            <!-- Botón -->
            <table cellpadding="0" cellspacing="0" style="margin:24px 0">
              <tr>
                <td style="background:#39A900;border-radius:10px">
                  <a href="${link}" target="_blank"
                     style="display:inline-block;padding:14px 36px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px">
                    Restablecer contraseña →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:16px 0 0;font-size:12px;color:#999;word-break:break-all">
              Si el botón no funciona, copie y pegue este enlace en su navegador:<br>
              <a href="${link}" style="color:#00304D">${link}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;border-top:1px solid #eee;padding:18px 32px;text-align:center">
            <p style="margin:0;font-size:11px;color:#aaa">
              Este correo fue generado automáticamente por el SEP · GGPC SENA<br>
              No responda a este mensaje · sep@sena.edu.co
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

    try {
      await this.transporter.sendMail({
        from: `"SEP – GGPC SENA" <${this.config.get('SMTP_USER', 'sep@sena.edu.co')}>`,
        to: email,
        subject: 'SEP — Restablecer contraseña',
        html,
      })
      this.logger.log(`Correo de restablecimiento enviado a ${email}`)
    } catch (err) {
      this.logger.error(`Error enviando correo a ${email}:`, err)
      throw err
    }
  }
}
