import "server-only";
import { Resend } from "resend";

/**
 * Where an email will actually go. On Resend's free tier without a verified domain you can only send to your own
 * account address, so RESEND_TEST_TO redirects every email to that test inbox.
 */
export function deliveryAddress(candidateEmail: string): { to: string; redirected: boolean } {
  const test = process.env.RESEND_TEST_TO?.trim();
  return test ? { to: test, redirected: true } : { to: candidateEmail, redirected: false };
}

export async function sendViaResend(candidateEmail: string, subject: string, body: string): Promise<string> {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set in .env.local");
  const { to, redirected } = deliveryAddress(candidateEmail);
  if (!to) throw new Error("No recipient email address.");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM || "Kargo Hiring <onboarding@resend.dev>",
    to: [to],
    subject: redirected ? `[TEST → ${candidateEmail}] ${subject}` : subject,
    text: body,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return data!.id;
}
