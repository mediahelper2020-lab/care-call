import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const DEV_KEY_SEED = "ai-care-call-development-key-not-for-production";

let cachedKey: Buffer | null = null;

/**
 * 운영 환경에서는 CARE_ENCRYPTION_KEY(32바이트 base64 또는 hex)를 반드시 설정해야 한다.
 * 미설정 시 개발 전용 고정키로 동작하며 실제 개인정보를 넣어서는 안 된다.
 */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.CARE_ENCRYPTION_KEY;
  if (raw) {
    const buf = raw.length === 64 ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (buf.length !== 32) {
      throw new Error("CARE_ENCRYPTION_KEY는 32바이트(base64 또는 hex)여야 합니다.");
    }
    cachedKey = buf;
  } else {
    cachedKey = crypto.createHash("sha256").update(DEV_KEY_SEED).digest();
  }
  return cachedKey;
}

export function isProductionKeyConfigured(): boolean {
  return Boolean(process.env.CARE_ENCRYPTION_KEY);
}

export function encryptField(plain: string): string {
  if (plain === "") return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptField(payload: string): string {
  if (payload === "") return "";
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return payload;
  const [, ivPart, tagPart, dataPart] = parts;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** 김영수 → 김○○ / Kim → K○ */
export function maskName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "○○○";
  if (trimmed.length === 1) return `${trimmed}○`;
  return trimmed[0] + "○".repeat(trimmed.length - 1);
}

/** 010-1234-5678 → 010-****-5678 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "***";
  const head = digits.slice(0, 3);
  const tail = digits.slice(-4);
  return `${head}-****-${tail}`;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone.trim();
}

export const DEFAULT_RETENTION_DAYS = 365;

export function retentionDays(): number {
  const raw = Number(process.env.CARE_RETENTION_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_RETENTION_DAYS;
}

export function retentionUntil(from: Date = new Date()): string {
  const until = new Date(from);
  until.setDate(until.getDate() + retentionDays());
  return until.toISOString();
}
