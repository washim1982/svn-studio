import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { SvnSettings, SvnSettingsPublic } from "../types/svn.types.js";

const DATA_DIR = process.env.DATA_DIR ?? "./data";
const SETTINGS_FILE = path.join(DATA_DIR, "settings.enc.json");
const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.SETTINGS_SECRET;
  if (!secret) {
    throw new Error("SETTINGS_SECRET environment variable is not set");
  }
  // Derive a stable 32-byte key regardless of the raw secret's length/format.
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export const DEFAULT_AI_ENDPOINT = "http://127.0.0.1:8181/v1"; // local llama.cpp gateway

interface StoredFile {
  repoUrl: string;
  username: string;
  workingCopyPath: string;
  passwordEnc?: string;
  aiEndpoint?: string;
  aiModel?: string;
  aiApiKeyEnc?: string;
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function loadSettings(): Promise<SvnSettings | null> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    const stored: StoredFile = JSON.parse(raw);
    return {
      repoUrl: stored.repoUrl,
      username: stored.username,
      workingCopyPath: stored.workingCopyPath,
      password: stored.passwordEnc ? decrypt(stored.passwordEnc) : "",
      aiEndpoint: stored.aiEndpoint ?? DEFAULT_AI_ENDPOINT,
      aiModel: stored.aiModel ?? "",
      aiApiKey: stored.aiApiKeyEnc ? decrypt(stored.aiApiKeyEnc) : "",
    };
  } catch (err: any) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function saveSettings(settings: SvnSettings): Promise<void> {
  await ensureDataDir();
  const stored: StoredFile = {
    repoUrl: settings.repoUrl,
    username: settings.username,
    workingCopyPath: settings.workingCopyPath,
    passwordEnc: settings.password ? encrypt(settings.password) : undefined,
    aiEndpoint: settings.aiEndpoint,
    aiModel: settings.aiModel,
    aiApiKeyEnc: settings.aiApiKey ? encrypt(settings.aiApiKey) : undefined,
  };
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(stored, null, 2), "utf8");
}

export function toPublic(settings: SvnSettings | null): SvnSettingsPublic {
  if (!settings) {
    return {
      repoUrl: "",
      username: "",
      workingCopyPath: "",
      hasPassword: false,
      aiEndpoint: DEFAULT_AI_ENDPOINT,
      aiModel: "",
      hasAiApiKey: false,
    };
  }
  return {
    repoUrl: settings.repoUrl,
    username: settings.username,
    workingCopyPath: settings.workingCopyPath,
    hasPassword: Boolean(settings.password),
    aiEndpoint: settings.aiEndpoint,
    aiModel: settings.aiModel,
    hasAiApiKey: Boolean(settings.aiApiKey),
  };
}
