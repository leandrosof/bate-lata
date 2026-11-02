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

type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraph(value: string): string {
  return `<p style="margin:0 0 14px;line-height:1.65;color:#cbd5e1;">${escapeHtml(value)}</p>`;
}

function emailLayout(input: {
  siteName: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:32px 16px;background:#070b14;font-family:Arial,Helvetica,sans-serif;color:#f8fafc;">
    <div style="max-width:540px;margin:0 auto;background:#0d1526;border:1px solid rgba(148,163,184,0.16);border-radius:20px;padding:32px;">
      <p style="margin:0 0 10px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#93a3bb;">${escapeHtml(input.siteName)}</p>
      <h1 style="margin:0 0 20px;font-size:24px;line-height:1.2;color:#ffffff;">${escapeHtml(input.heading)}</h1>
      ${input.body}
      ${
        input.ctaLabel && input.ctaUrl
          ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#2f6bff;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:12px;">${escapeHtml(input.ctaLabel)}</a></p>`
          : ""
      }
      <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#93a3bb;">${escapeHtml(input.footer ?? "Você recebeu este e-mail porque tem uma conta no grupo.")}</p>
    </div>
  </body>
</html>`;
}

export function welcomeVerificationEmail(input: {
  name: string;
  siteName: string;
  link: string;
  expiresHours?: number;
}): EmailContent {
  const expires = input.expiresHours ?? 24;
  const subject = `Bem-vindo ao ${input.siteName} — confirme seu e-mail`;
  const text = [
    `Olá, ${input.name}!`,
    "",
    `Sua conta no ${input.siteName} foi criada.`,
    `Confirme seu e-mail para ativar o acesso:`,
    input.link,
    "",
    `Este link expira em ${expires} horas.`,
    "Se você não criou esta conta, ignore este e-mail.",
  ].join("\n");
  const html = emailLayout({
    siteName: input.siteName,
    heading: `Bem-vindo, ${input.name}!`,
    body: [
      paragraph(`Sua conta no ${input.siteName} foi criada.`),
      paragraph(`Confirme seu e-mail para ativar o acesso. O link expira em ${expires} horas.`),
    ].join(""),
    ctaLabel: "Confirmar meu e-mail",
    ctaUrl: input.link,
    footer: "Se você não criou esta conta, ignore este e-mail.",
  });
  return { subject, text, html };
}

export function attendanceConfirmedEmail(input: {
  name: string;
  siteName: string;
  eventTitle: string;
  startsAtLabel: string;
  venueName: string;
  link: string;
}): EmailContent {
  const subject = `Presença confirmada — ${input.eventTitle}`;
  const text = [
    `Olá, ${input.name}!`,
    "",
    `Sua presença está confirmada em ${input.eventTitle}.`,
    `${input.startsAtLabel} · ${input.venueName}`,
    "",
    `Veja o evento: ${input.link}`,
  ].join("\n");
  const html = emailLayout({
    siteName: input.siteName,
    heading: "Presença confirmada",
    body: [
      paragraph(`Olá, ${input.name}! Sua presença está confirmada.`),
      paragraph(`${input.eventTitle}\n${input.startsAtLabel} · ${input.venueName}`),
    ].join(""),
    ctaLabel: "Ver evento",
    ctaUrl: input.link,
  });
  return { subject, text, html };
}

export function attendanceWaitlistEmail(input: {
  name: string;
  siteName: string;
  eventTitle: string;
  startsAtLabel: string;
  venueName: string;
  position: number;
  link: string;
}): EmailContent {
  const subject = `Você entrou na lista de espera — ${input.eventTitle}`;
  const text = [
    `Olá, ${input.name}!`,
    "",
    `Você entrou na lista de espera de ${input.eventTitle} na posição ${input.position}.`,
    `${input.startsAtLabel} · ${input.venueName}`,
    "",
    `Se abrir uma vaga, você será chamado. Veja o evento: ${input.link}`,
  ].join("\n");
  const html = emailLayout({
    siteName: input.siteName,
    heading: "Você está na lista de espera",
    body: [
      paragraph(`Olá, ${input.name}! Você entrou na lista de espera de ${input.eventTitle}.`),
      paragraph(`Sua posição atual é ${input.position}. Se abrir uma vaga, você será chamado.`),
      paragraph(`${input.startsAtLabel} · ${input.venueName}`),
    ].join(""),
    ctaLabel: "Ver evento",
    ctaUrl: input.link,
  });
  return { subject, text, html };
}

export function newEventEmail(input: {
  name: string;
  siteName: string;
  eventTitle: string;
  startsAtLabel: string;
  venueName: string;
  surfaceLabel?: string;
  link: string;
}): EmailContent {
  const subject = `Novo jogo agendado — ${input.eventTitle}`;
  const details = [input.startsAtLabel, input.venueName, input.surfaceLabel].filter(Boolean).join(" · ");
  const text = [
    `Olá, ${input.name}!`,
    "",
    `Um novo jogo foi agendado: ${input.eventTitle}.`,
    details,
    "",
    `Confirme sua presença: ${input.link}`,
  ].join("\n");
  const html = emailLayout({
    siteName: input.siteName,
    heading: "Novo jogo agendado",
    body: [
      paragraph(`Olá, ${input.name}! Um novo jogo foi agendado.`),
      paragraph(`${input.eventTitle}\n${details}`),
    ].join(""),
    ctaLabel: "Ver evento e confirmar",
    ctaUrl: input.link,
  });
  return { subject, text, html };
}

export function announcementEmail(input: {
  name: string;
  siteName: string;
  title: string;
  body: string;
  link: string;
}): EmailContent {
  const subject = `${input.title} — ${input.siteName}`;
  const text = [`Olá, ${input.name}!`, "", input.title, "", input.body, "", `Acesse: ${input.link}`].join("\n");
  const html = emailLayout({
    siteName: input.siteName,
    heading: input.title,
    body: [
      paragraph(`Olá, ${input.name}!`),
      paragraph(input.body),
    ].join(""),
    ctaLabel: "Abrir o site",
    ctaUrl: input.link,
  });
  return { subject, text, html };
}

export function roleChangedEmail(input: {
  name: string;
  siteName: string;
  role: "ADMIN" | "PLAYER";
  link: string;
}): EmailContent {
  const isAdmin = input.role === "ADMIN";
  const subject = `Seu acesso no ${input.siteName} foi atualizado`;
  const text = [
    `Olá, ${input.name}!`,
    "",
    isAdmin
      ? "Seu perfil agora é Administrador. Você pode gerenciar eventos, jogadores e resultados."
      : "Seu perfil agora é Jogador. Seu acesso às ferramentas administrativas foi removido.",
    "",
    `Acesse: ${input.link}`,
  ].join("\n");
  const html = emailLayout({
    siteName: input.siteName,
    heading: "Seu acesso foi atualizado",
    body: [
      paragraph(`Olá, ${input.name}!`),
      paragraph(
        isAdmin
          ? "Seu perfil agora é Administrador. Você pode gerenciar eventos, jogadores e resultados."
          : "Seu perfil agora é Jogador. Seu acesso às ferramentas administrativas foi removido.",
      ),
    ].join(""),
    ctaLabel: "Abrir o site",
    ctaUrl: input.link,
    footer: "Se você não reconhece esta alteração, fale com um administrador.",
  });
  return { subject, text, html };
}

export function eventCancelledEmail(input: {
  name: string;
  siteName: string;
  eventTitle: string;
  startsAtLabel: string;
  link: string;
}): EmailContent {
  const subject = `Evento cancelado — ${input.eventTitle}`;
  const text = [
    `Olá, ${input.name}!`,
    "",
    `O evento ${input.eventTitle} (${input.startsAtLabel}) foi cancelado.`,
    "",
    `Veja a agenda: ${input.link}`,
  ].join("\n");
  const html = emailLayout({
    siteName: input.siteName,
    heading: "Evento cancelado",
    body: [
      paragraph(`Olá, ${input.name}! O evento abaixo foi cancelado.`),
      paragraph(`${input.eventTitle}\n${input.startsAtLabel}`),
    ].join(""),
    ctaLabel: "Ver agenda",
    ctaUrl: input.link,
  });
  return { subject, text, html };
}

export function paymentPendingEmail(input: {
  name: string;
  siteName: string;
  eventTitle: string;
  startsAtLabel: string;
  venueName: string;
  amountLabel: string;
  pixKey: string;
  pixRecipientName?: string | null;
  pixInstructions?: string | null;
  link: string;
}): EmailContent {
  const subject = `Reserve sua vaga e faça o Pix — ${input.eventTitle}`;
  const text = [
    `Olá, ${input.name}!`,
    "",
    `Sua vaga em ${input.eventTitle} está reservada, mas ainda aguarda a confirmação do pagamento.`,
    `${input.startsAtLabel} · ${input.venueName}`,
    `Valor: ${input.amountLabel}`,
    `Chave Pix: ${input.pixKey}`,
    input.pixRecipientName ? `Recebedor: ${input.pixRecipientName}` : "",
    input.pixInstructions ?? "",
    "",
    `Veja o evento: ${input.link}`,
    "",
    "O administrador confere o pagamento manualmente antes de confirmar sua presença.",
  ]
    .filter(Boolean)
    .join("\n");
  const html = emailLayout({
    siteName: input.siteName,
    heading: "Sua vaga está reservada",
    body: [
      paragraph(`Olá, ${input.name}! Sua vaga em ${input.eventTitle} está reservada.`),
      paragraph(`${input.startsAtLabel} · ${input.venueName}`),
      paragraph(
        `Valor: ${input.amountLabel}\nChave Pix: ${input.pixKey}${
          input.pixRecipientName ? `\nRecebedor: ${input.pixRecipientName}` : ""
        }${input.pixInstructions ? `\n${input.pixInstructions}` : ""}`,
      ),
      paragraph("O administrador confere o pagamento manualmente antes de confirmar sua presença."),
    ].join(""),
    ctaLabel: "Ver evento",
    ctaUrl: input.link,
  });
  return { subject, text, html };
}

export function paymentApprovedEmail(input: {
  name: string;
  siteName: string;
  eventTitle: string;
  startsAtLabel: string;
  venueName: string;
  link: string;
}): EmailContent {
  const subject = `Pagamento aprovado — ${input.eventTitle}`;
  const text = [
    `Olá, ${input.name}!`,
    "",
    `Seu pagamento foi aprovado e sua presença está confirmada em ${input.eventTitle}.`,
    `${input.startsAtLabel} · ${input.venueName}`,
    "",
    `Veja o evento: ${input.link}`,
  ].join("\n");
  const html = emailLayout({
    siteName: input.siteName,
    heading: "Pagamento aprovado",
    body: [
      paragraph(`Olá, ${input.name}! Seu pagamento foi aprovado e sua presença está confirmada.`),
      paragraph(`${input.eventTitle}\n${input.startsAtLabel} · ${input.venueName}`),
    ].join(""),
    ctaLabel: "Ver evento",
    ctaUrl: input.link,
  });
  return { subject, text, html };
}

export function paymentRejectedEmail(input: {
  name: string;
  siteName: string;
  eventTitle: string;
  link: string;
}): EmailContent {
  const subject = `Pagamento não identificado — ${input.eventTitle}`;
  const text = [
    `Olá, ${input.name}!`,
    "",
    `Não conseguimos identificar o pagamento da sua vaga em ${input.eventTitle}.`,
    "Sua vaga foi liberada. Fale com um administrador para regularizar ou tentar novamente.",
    "",
    `Veja o evento: ${input.link}`,
  ].join("\n");
  const html = emailLayout({
    siteName: input.siteName,
    heading: "Pagamento não identificado",
    body: [
      paragraph(`Olá, ${input.name}! Não conseguimos identificar o pagamento da sua vaga.`),
      paragraph("Sua vaga foi liberada. Fale com um administrador para regularizar ou tentar novamente."),
    ].join(""),
    ctaLabel: "Ver evento",
    ctaUrl: input.link,
  });
  return { subject, text, html };
}
