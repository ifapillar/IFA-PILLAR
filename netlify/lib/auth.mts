import { randomBytes, scrypt, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { settings } from "../../db/schema.js";

const scryptAsync = promisify(scrypt);

const PASSCODE_KEY = "admin_passcode";
const SECRET_KEY = "session_secret";
const COOKIE_NAME = "ifa_studio";
const SESSION_HOURS = 12;

export async function readSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value ?? null;
}

export async function writeSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** True once the owner has chosen a studio passcode. */
export async function isConfigured(): Promise<boolean> {
  const stored = await readSetting(PASSCODE_KEY);
  return Boolean(stored);
}

async function hash(passcode: string, salt: string): Promise<string> {
  const derived = (await scryptAsync(passcode.normalize("NFKC"), salt, 64)) as Buffer;
  return derived.toString("hex");
}

export async function setPasscode(passcode: string): Promise<void> {
  const salt = randomBytes(16).toString("hex");
  await writeSetting(PASSCODE_KEY, `${salt}:${await hash(passcode, salt)}`);
}

export async function verifyPasscode(passcode: string): Promise<boolean> {
  const stored = await readSetting(PASSCODE_KEY);
  if (!stored) return false;
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = await hash(passcode, salt);
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function sessionSecret(): Promise<string> {
  const existing = await readSetting(SECRET_KEY);
  if (existing) return existing;
  const secret = randomBytes(32).toString("hex");
  await writeSetting(SECRET_KEY, secret);
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function issueSessionCookie(): Promise<string> {
  const secret = await sessionSecret();
  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const token = `${expires}.${sign(String(expires), secret)}`;
  const maxAge = SESSION_HOURS * 60 * 60;
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/** Validates the signed session cookie on the request. */
export async function isAuthenticated(req: Request): Promise<boolean> {
  const cookies = req.headers.get("cookie") ?? "";
  const match = cookies.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;

  const [expires, signature] = match.slice(COOKIE_NAME.length + 1).split(".");
  if (!expires || !signature) return false;
  if (Number(expires) < Date.now()) return false;

  const expected = sign(expires, await sessionSecret());
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unauthorized(): Response {
  return Response.json({ error: "Not signed in to the studio." }, { status: 401 });
}
