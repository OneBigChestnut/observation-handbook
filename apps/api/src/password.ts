import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const hashLength = 64;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) {
    throw new Error("password must contain at least 12 characters");
  }

  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, hashLength) as Buffer;
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, encodedSalt, encodedDerived] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedDerived) return false;

  try {
    const salt = Buffer.from(encodedSalt, "base64");
    const expected = Buffer.from(encodedDerived, "base64");
    if (salt.length !== 16 || expected.length !== hashLength) return false;
    const actual = await scrypt(password, salt, hashLength) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
