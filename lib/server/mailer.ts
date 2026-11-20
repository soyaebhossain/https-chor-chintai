import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { getEnv } from "@/lib/server/env";

let transport: Transporter | undefined;

/**
 * Sends a plain-text email. Without SMTP_URL (development only — the env
 * check makes it mandatory in production) the message is printed to the
 * server log and saved to .dev-mail/<recipient>.txt (git-ignored) so login
 * codes can be used locally and read by the end-to-end tests.
 */
export async function sendMail(message: { to: string; subject: string; text: string }): Promise<void> {
  const env = getEnv();
  if (!env.SMTP_URL) {
    console.info(`\n[mail:dev] To: ${message.to}\n[mail:dev] Subject: ${message.subject}\n${message.text}\n`);
    if (env.NODE_ENV !== "production") {
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
