import { after } from "next/server";
import { sendEmail } from "@/lib/email";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

async function sendSafe(message: EmailMessage): Promise<void> {
  try {
    await sendEmail(message);
  } catch (error) {
    console.error("[email] falha ao enviar e-mail", error);
  }
}

export function queueEmail(message: EmailMessage): void {
  after(async () => {
    await sendSafe(message);
  });
}

export function queueEmails(messages: EmailMessage[]): void {
  if (messages.length === 0) return;

  after(async () => {
    for (let index = 0; index < messages.length; index += 4) {
      await Promise.allSettled(messages.slice(index, index + 4).map(sendSafe));
    }
  });
}
