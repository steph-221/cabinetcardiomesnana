// Les tâches planifiées de Vercel appellent leur route avec « Authorization: Bearer CRON_SECRET ».

import { timingSafeEqual } from "node:crypto";

export function secretTacheValide(request: Request) {
  const attendu = process.env.CRON_SECRET;
  if (!attendu || attendu.length < 16) return false;
  const recu = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer /, ""));
  const a = Buffer.from(attendu);
  return recu.length === a.length && timingSafeEqual(recu, a);
}
