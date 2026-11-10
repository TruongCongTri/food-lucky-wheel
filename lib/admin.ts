import "server-only";
import { timingSafeEqual } from "node:crypto";

/** If ADMIN_PIN is set, mutations require a matching `x-admin-pin` header. */
export function isAuthorized(request: Request): boolean {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return true;
  const given = request.headers.get("x-admin-pin") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(pin);
  return a.length === b.length && timingSafeEqual(a, b);
}
