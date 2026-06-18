import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

interface SendAuthorizationRequestParams {
  demandadoEmail: string;
  demandadoNombre: string;
  sujetoNombre: string;
  sujetoVinculo: string;
  sujetoRepresentante?: string;
  sujetoEmail?: string;
  causaCaratula: string;
  expedienteNro: string | number;
  token: string;
  frontendUrl: string;
}

export async function sendAuthorizationRequest(params: SendAuthorizationRequestParams): Promise<void> {
  const {
    demandadoEmail,
    demandadoNombre,
    sujetoNombre,
    sujetoVinculo,
    sujetoRepresentante,
    sujetoEmail,
    causaCaratula,
    token,
    frontendUrl,
  } = params;

  const authUrl = `${frontendUrl.replace(/\/$/, '')}/autorizar?token=${token}`;

  console.log('[EMAIL] Intentando enviar mail a:', params.demandadoEmail);

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: demandadoEmail,
    subject: `Solicitud de acceso al expediente ${causaCaratula}`,
    html: `
      <p>Estimado/a ${demandadoNombre},</p>
      <p>${sujetoNombre} (${sujetoVinculo}) solicita acceso al expediente ${causaCaratula}.</p>
      ${sujetoRepresentante ? `<p>Patrocinante: ${sujetoRepresentante}</p>` : ''}
      ${sujetoEmail ? `<p>Email de contacto: ${sujetoEmail}</p>` : ''}
      <p><a href="${authUrl}">Autorizar acceso</a></p>
      <p>Si no reconocés esta solicitud, ignorá este correo.</p>
    `,
  });
}
