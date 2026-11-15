// Outbound email. One small interface, so the watch code never knows which
// sender it has: the real one (Resend), a developer one that only logs, or the
// recording one the tests use.
import { maskEmail } from './mask.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
}

export interface EmailSender {
  send(msg: EmailMessage): Promise<void>;
}

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Sends through Resend. Errors say only what happened (a status code or "could
 * not reach"); they never repeat the address, the key or the service's reply,
 * because errors end up in logs.
 */
export function resendSender(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): EmailSender {
  return {
    async send(msg) {
      let status: number;
      try {
        const res = await fetchImpl(RESEND_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from,
            to: [msg.to],
            subject: msg.subject,
            text: msg.text,
            html: msg.html,
            headers: msg.headers ?? {},
          }),
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
        });
        status = res.status;
      } catch {
        throw new Error('The email service could not be reached.');
      }
      if (status < 200 || status >= 300) {
        throw new Error(`The email service refused the message (status ${status}).`);
      }
    },
  };
}

/** Records every message and sends nothing. For tests. */
export class FakeSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  /** Every call to send, failed ones included. */
  attempts = 0;
  /** How many of the next sends should fail. */
  failures = 0;

  async send(msg: EmailMessage): Promise<void> {
    this.attempts++;
    if (this.failures > 0) {
      this.failures--;
      throw new Error('The email service refused the message (status 500).');
    }
    this.sent.push(msg);
  }
}

/**
 * For local development (EMAIL_SENDER=fake): sends nothing, and writes the
 * subject, the masked address and the links to the server log so a developer
 * can follow the confirmation link.
 */
export function devLogSender(log: (line: string) => void = (line) => console.log(line)): EmailSender {
  return {
    async send(msg) {
      const links = msg.text.match(/https?:\/\/[^\s<>"]+/g) ?? [];
      log(
        [
          `[watch] email not sent (developer sender): "${msg.subject}" to ${maskEmail(msg.to)}`,
          ...[...new Set(links)].map((l) => `[watch]   link: ${l}`),
        ].join('\n'),
      );
    },
  };
}
