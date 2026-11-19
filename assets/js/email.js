// Client-side email validation for the demo opt-in. Pragmatic, not RFC 5322 complete:
// it accepts the addresses real people type and rejects the common typos.

const LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const TLD = /^(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$/;

/** Returns { ok: true, value } with the trimmed address, or { ok: false, error } with a message for the visitor. */
export function validateEmail(raw) {
  const value = String(raw ?? "").trim();
  if (value === "") return { ok: false, error: "Enter your email address." };
  if (value.length > 254) return { ok: false, error: "That email address is too long." };
  const at = value.lastIndexOf("@");
  if (at < 1 || at === value.length - 1 || value.indexOf("@") !== at) {
    return { ok: false, error: "Enter an email address like name@example.com." };
  }
  const local = value.slice(0, at);
  const labels = value.slice(at + 1).split(".");
  const domainOk =
    labels.length >= 2 && labels.every((l) => LABEL.test(l)) && TLD.test(labels[labels.length - 1]);
  if (local.length > 64 || !LOCAL.test(local) || !domainOk) {
    return { ok: false, error: "Enter an email address like name@example.com." };
  }
  return { ok: true, value };
}

export const isValidEmail = (raw) => validateEmail(raw).ok;
