import nodemailer from 'nodemailer';

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendVerificationEmail(to: string, username: string, verifyUrl: string): Promise<void> {
  const transporter = buildTransporter();
  if (!transporter) {
    throw new Error('SMTP is not configured');
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@socialnet.local';
  await transporter.sendMail({
    from,
    to,
    subject: 'Xac thuc tai khoan SocialNet',
    text: `Xin chao ${username},\n\nVui long bam vao link sau de xac thuc tai khoan:\n${verifyUrl}\n\nLink co hieu luc trong 24 gio.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Xin chao ${username},</h2>
        <p>Cam on ban da dang ky SocialNet.</p>
        <p>Vui long bam vao nut ben duoi de xac thuc email:</p>
        <p>
          <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
            Xac thuc tai khoan
          </a>
        </p>
        <p>Hoac copy link sau vao trinh duyet:</p>
        <p>${verifyUrl}</p>
        <p>Link co hieu luc trong 24 gio.</p>
      </div>
    `,
  });
}
