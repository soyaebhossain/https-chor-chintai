import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { getEnv } from "@/lib/server/env";

let transport: Transporter | undefined;

export class MailNotConfiguredError extends Error {
  constructor() {
    super("Email is not configured (SMTP_URL/MAIL_FROM)");
  }
}

/** Whether real email can be sent. In development a log/file sink stands in for it. */
export function mailAvailable(): boolean {
  const env = getEnv();
  return Boolean(env.SMTP_URL) || env.NODE_ENV !== "production";
}

/**
 * Sends a plain-text email. Without SMTP_URL in development the message is
 * printed to the server log and saved to .dev-mail/<recipient>.txt
 * (git-ignored) so login codes can be used locally and by the E2E tests.
 * In production without SMTP it throws — messages (login codes!) must never
 * end up in hosted logs.
 */
export async function sendMail(message: { to: string; subject: string; text: string }): Promise<void> {
  const env = getEnv();
  if (!env.SMTP_URL) {
    if (env.NODE_ENV === "production") throw new MailNotConfiguredError();
    console.info(`\n[mail:dev] To: ${message.to}\n[mail:dev] Subject: ${message.subject}\n${message.text}\n`);
    {
      const dir = path.join(process.cwd(), ".dev-mail");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${message.to.replace(/[^a-z0-9@._-]/gi, "_")}.txt`), `Subject: ${message.subject}\n\n${message.text}`);
    }
    return;
  }
  transport ??= nodemailer.createTransport(env.SMTP_URL);
  await transport.sendMail({ from: env.MAIL_FROM, ...message });
}

/** For notifications that must not break the main action if mail is down. */
export async function sendMailSafely(message: { to: string; subject: string; text: string }): Promise<void> {
  try {
    await sendMail(message);
  } catch (error) {
    console.error("mail delivery failed:", error instanceof Error ? error.message : error);
  }
}
