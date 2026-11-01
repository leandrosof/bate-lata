import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "Arena do Vôlei <nao-responda@localhost>";
}

function hasResend(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function hasSmtp(): boolean {
  return Boolean(process.env.SMTP_URL?.trim() || process.env.SMTP_HOST?.trim());
}

export async function sendEmail(input: SendEmailInput): Promise<"resend" | "smtp" | "outbox"> {
  if (hasResend()) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Falha no envio via Resend (${response.status}): ${detail.slice(0, 200)}`);
    }
    return "resend";
  }

  if (hasSmtp()) {
    const nodemailer = await import("nodemailer");
    const transport = process.env.SMTP_URL?.trim()
      ? nodemailer.createTransport(process.env.SMTP_URL.trim())
      : nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        });
    await transport.sendMail({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return "smtp";
  }

  const dir = process.env.OUTBOX_DIR?.trim() || path.join(process.cwd(), ".data", "outbox");
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeRecipient = input.to.replace(/[^a-zA-Z0-9@._-]/g, "_");
  const file = path.join(dir, `${stamp}-${safeRecipient}.txt`);
  const content = [
    `To: ${input.to}`,
    `From: ${fromAddress()}`,
    `Subject: ${input.subject}`,
    `Date: ${new Date().toISOString()}`,
    "",
    input.text,
    "",
    "----- HTML -----",
    input.html,
    "",
  ].join("\n");
  await writeFile(file, content, "utf8");
  console.log(`[email] Nenhum provedor configurado. E-mail salvo em ${file}`);
  return "outbox";
}

export function passwordResetEmail(input: {
  name: string;
  siteName: string;
  link: string;
}): { subject: string; text: string; html: string } {
  const subject = `Redefinição de senha · ${input.siteName}`;
  const text = [
    `Olá, ${input.name}!`,
    "",
    `Recebemos um pedido para redefinir sua senha no ${input.siteName}.`,
    `Acesse o link abaixo (válido por 1 hora):`,
    input.link,
    "",
    "Se você não fez esse pedido, ignore este e-mail.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:32px;background:#070b14;font-family:Arial,Helvetica,sans-serif;color:#f8fafc;">
    <div style="max-width:520px;margin:0 auto;background:#0d1526;border:1px solid rgba(148,163,184,0.16);border-radius:18px;padding:32px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#93a3bb;">${input.siteName}</p>
      <h1 style="margin:0 0 20px;font-size:24px;color:#ffffff;">Redefinição de senha</h1>
      <p style="margin:0 0 12px;line-height:1.6;color:#cbd5e1;">Olá, ${input.name}!</p>
      <p style="margin:0 0 24px;line-height:1.6;color:#cbd5e1;">Recebemos um pedido para redefinir sua senha. O link abaixo é válido por 1 hora e só pode ser usado uma vez.</p>
      <a href="${input.link}" style="display:inline-block;background:#2f6bff;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:12px;">Criar nova senha</a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#93a3bb;">Se o botão não funcionar, copie e cole este link no navegador:<br /><span style="color:#7dd3fc;word-break:break-all;">${input.link}</span></p>
      <p style="margin:24px 0 0;font-size:13px;color:#93a3bb;">Se você não fez esse pedido, ignore este e-mail.</p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}
