export type Channel = "email" | "sms";

export interface Identity {
  channel: Channel;
  /** Lower-cased email, or phone in E.164 form (+919876543210). */
  value: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Turns what the person typed into a clean email or phone identity.
 * Phone numbers without a "+" get defaultCountryCode (for example "+91").
 * Returns null when the text is not a valid email or phone number.
 */
export function parseIdentifier(
  raw: string,
  defaultCountryCode: string,
): Identity | null {
  const text = raw.trim();
  if (!text) return null;

  if (text.includes("@")) {
    const email = text.toLowerCase();
    return email.length <= 254 && EMAIL_RE.test(email)
      ? { channel: "email", value: email }
      : null;
  }

  const digits = text.replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(digits)) return null;

  let phone: string;
  if (digits.startsWith("+")) {
    phone = digits;
  } else if (digits.startsWith("00")) {
    phone = `+${digits.slice(2)}`;
  } else {
    const countryDigits = defaultCountryCode.replace("+", "");
    const local = digits.replace(/^0+/, "");
    // "919876543210": the country code was typed without the "+"
    phone =
      local.length > 10 && local.startsWith(countryDigits)
        ? `+${local}`
        : `${defaultCountryCode}${local}`;
  }

  return /^\+[1-9]\d{7,14}$/.test(phone) ? { channel: "sms", value: phone } : null;
}

/** "r***@example.com" or "+91••••••3210" - safe to show on screen. */
export function maskIdentity(identity: Identity): string {
  if (identity.channel === "email") {
    const [name = "", domain = ""] = identity.value.split("@");
    return `${name.slice(0, 1)}***@${domain}`;
  }
  const phone = identity.value;
  return `${phone.slice(0, 3)}${"•".repeat(Math.max(phone.length - 7, 2))}${phone.slice(-4)}`;
}
