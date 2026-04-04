const MAX_ATTEMPTS = 3;

export interface NoteData {
  c: string;
  iv: string;
  pw: boolean;
  ts: number;
  exp: number;
  attempts?: number;
  title?: string;
  burnMsg?: string;
  maxViews?: number;
  views?: number;
  allowedIps?: string[];
}

export interface NoteInput {
  c: string;
  iv: string;
  pw: boolean;
  ttl: number;
  title?: string;
  burnMsg?: string;
  maxViews?: number;
  allowedIps?: string[];
}

export async function saveNote(
  kv: KVNamespace,
  input: NoteInput
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const data: NoteData = {
    c: input.c,
    iv: input.iv,
    pw: input.pw,
    ts: now,
    exp: now + input.ttl,
    attempts: 0,
    maxViews: input.maxViews ?? 1,
    views: 0,
    ...(input.title ? { title: input.title } : {}),
    ...(input.burnMsg ? { burnMsg: input.burnMsg } : {}),
    ...(input.allowedIps && input.allowedIps.length > 0 ? { allowedIps: input.allowedIps } : {}),
  };
  await kv.put(`note:${id}`, JSON.stringify(data), {
    expirationTtl: input.ttl,
  });
  return id;
}

export async function getAndDeleteNote(
  kv: KVNamespace,
  id: string
): Promise<NoteData | null> {
  const key = `note:${id}`;
  const raw = await kv.get(key);
  if (!raw) return null;
  await kv.delete(key);
  return JSON.parse(raw) as NoteData;
}

export async function incrementAttempts(
  kv: KVNamespace,
  id: string
): Promise<{ note: NoteData; remaining: number } | null> {
  const key = `note:${id}`;
  const raw = await kv.get(key, { type: "text" });
  if (!raw) return null;
  const note = JSON.parse(raw) as NoteData;
  const attempts = (note.attempts ?? 0) + 1;
  note.attempts = attempts;

  if (attempts >= MAX_ATTEMPTS) {
    await kv.delete(key);
    return { note, remaining: 0 };
  }

  // Use absolute expiration to preserve the original TTL
  await kv.put(key, JSON.stringify(note), { expiration: note.exp });

  return { note, remaining: MAX_ATTEMPTS - attempts };
}

export async function deleteNote(
  kv: KVNamespace,
  id: string
): Promise<boolean> {
  const key = `note:${id}`;
  const exists = await kv.get(key);
  if (!exists) return false;
  await kv.delete(key);
  return true;
}

export async function getNoteMetadata(
  kv: KVNamespace,
  id: string
): Promise<{ pw: boolean; ts: number; title?: string; burnMsg?: string; maxViews?: number; allowedIps?: string[] } | null> {
  const key = `note:${id}`;
  const raw = await kv.get(key);
  if (!raw) return null;
  const data = JSON.parse(raw) as NoteData;
  return {
    pw: data.pw,
    ts: data.ts,
    ...(data.title ? { title: data.title } : {}),
    ...(data.burnMsg ? { burnMsg: data.burnMsg } : {}),
    ...(data.maxViews !== undefined ? { maxViews: data.maxViews } : {}),
    ...(data.allowedIps && data.allowedIps.length > 0 ? { allowedIps: data.allowedIps } : {}),
  };
}

export function isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
  if (!allowedIps || allowedIps.length === 0) return true;

  for (const entry of allowedIps) {
    if (!entry.includes("/")) {
      if (clientIp === entry) return true;
      continue;
    }

    const [network, prefixStr] = entry.split("/");
    const prefix = parseInt(prefixStr, 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) continue;

    const clientInt = ipToInt(clientIp);
    const networkInt = ipToInt(network);
    if (clientInt === null || networkInt === null) continue;

    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    if ((clientInt & mask) === (networkInt & mask)) return true;
  }

  return false;
}

function ipToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    result = (result * 256 + n) >>> 0;
  }
  return result;
}

export async function getAndDecrementViews(
  kv: KVNamespace,
  id: string
): Promise<{ note: NoteData; remaining: number } | null> {
  const key = `note:${id}`;
  const raw = await kv.get(key, { type: "text" });
  if (!raw) return null;
  const note = JSON.parse(raw) as NoteData;
  const maxViews = note.maxViews ?? 1;
  const views = (note.views ?? 0) + 1;
  note.views = views;

  if (views >= maxViews) {
    await kv.delete(key);
    return { note, remaining: 0 };
  }

  await kv.put(key, JSON.stringify(note), { expiration: note.exp });
  return { note, remaining: maxViews - views };
}

export async function incrementStat(kv: KVNamespace, key: string): Promise<void> {
  const statKey = `stats:${key}`;
  const raw = await kv.get(statKey);
  const current = raw ? Number(raw) : 0;
  await kv.put(statKey, String(current + 1));
}

export async function getStats(kv: KVNamespace): Promise<{ created: number; burned: number }> {
  const [createdRaw, burnedRaw] = await Promise.all([
    kv.get("stats:created"),
    kv.get("stats:burned"),
  ]);
  return {
    created: createdRaw ? Number(createdRaw) : 0,
    burned: burnedRaw ? Number(burnedRaw) : 0,
  };
}
