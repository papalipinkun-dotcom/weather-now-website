import type { Identity } from "./identity";
import { isProduction } from "./auth-config";
import { logger } from "./logger";

export class DeliveryError extends Error {}

/**
 * Sends a sign-in code.
 * - Email: set RESEND_API_KEY and EMAIL_FROM (https://resend.com)
 * - SMS:   set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (https://twilio.com)
 * Without those, local development falls back to "console" mode: the code is
 * printed in the API terminal and shown on the login page. Production refuses to do that.
 */
export async function deliverCode(
  identity: Identity,
  code: string,
): Promise<"sent" | "console"> {
  const message = `Your Weather Now sign-in code is ${code}. It expires in 5 minutes. If you did not ask for it, ignore this message.`;

  if (identity.channel === "email") {
    const key = process.env["RESEND_API_KEY"];
    const from = process.env["EMAIL_FROM"];
    if (key && from) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [identity.value],
          subject: `Your Weather Now code: ${code}`,
          text: message,
        }),
      });
      if (!res.ok) throw new DeliveryError(`Email provider returned ${res.status}`);
      return "sent";
    }
  } else {
    const sid = process.env["TWILIO_ACCOUNT_SID"];
    const token = process.env["TWILIO_AUTH_TOKEN"];
    const from = process.env["TWILIO_FROM"];
    if (sid && token && from) {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: identity.value, From: from, Body: message }),
        },
      );
      if (!res.ok) throw new DeliveryError(`SMS provider returned ${res.status}`);
      return "sent";
    }
  }

  if (isProduction()) {
    throw new DeliveryError(`No ${identity.channel === "email" ? "email" : "SMS"} provider is configured.`);
  }

  logger.warn(`DEMO MODE - sign-in code for ${identity.value}: ${code}`);
  return "console";
}
