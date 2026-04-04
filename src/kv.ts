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

  const clientBytes = parseIp(clientIp);
  if (clientBytes === null) return false;

  for (const entry of allowedIps) {
    if (!entry.includes("/")) {
      const entryBytes = parseIp(entry);
      if (entryBytes !== null && matchesCidr(clientBytes, entryBytes, 128)) return true;
      continue;
    }

    const slashIdx = entry.lastIndexOf("/");
    const network = entry.slice(0, slashIdx);
    const prefixStr = entry.slice(slashIdx + 1);
    const rawPrefix = parseInt(prefixStr, 10);
    if (isNaN(rawPrefix) || rawPrefix < 0) continue;

    const networkBytes = parseIp(network);
    if (networkBytes === null) continue;

    const isIpv4Network = network.includes(".");
    const isIpv6Network = network.includes(":");
    const maxPrefix = isIpv4Network && !isIpv6Network ? 32 : 128;
    if (rawPrefix > maxPrefix) continue;

    const prefixLen = isIpv4Network && !isIpv6Network ? rawPrefix + 96 : rawPrefix;

    if (matchesCidr(clientBytes, networkBytes, prefixLen)) return true;
  }

  return false;
}

function parseIp(ip: string): Uint8Array | null {
  if (ip.includes(":")) return parseIpv6(ip);
  if (ip.includes(".")) return parseIpv4(ip);
  return null;
}

function parseIpv4(ip: string): Uint8Array | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const bytes = new Uint8Array(16);
  bytes[10] = 0xff;
  bytes[11] = 0xff;
  for (let i = 0; i < 4; i++) {
    const n = parseInt(parts[i], 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    bytes[12 + i] = n;
  }
  return bytes;
}

function parseIpv6(ip: string): Uint8Array | null {
  const bytes = new Uint8Array(16);

  if (ip.includes("::")) {
    const sides = ip.split("::");
    if (sides.length !== 2) return null;

    const left = sides[0] ? sides[0].split(":") : [];
    const right = sides[1] ? sides[1].split(":") : [];

    let rightGroups: number[] | null;
    let rightLen: number;

    if (right.length > 0 && right[right.length - 1].includes(".")) {
      const ipv4Part = right[right.length - 1];
      const ipv4Bytes = parseIpv4(ipv4Part);
      if (ipv4Bytes === null) return null;
      const prefixGroups: number[] = [];
      for (const g of right.slice(0, -1)) {
        const v = parseInt(g, 16);
        if (isNaN(v) || v < 0 || v > 0xffff) return null;
        prefixGroups.push(v);
      }
      rightGroups = [...prefixGroups, (ipv4Bytes[12] << 8) | ipv4Bytes[13], (ipv4Bytes[14] << 8) | ipv4Bytes[15]];
      rightLen = prefixGroups.length + 2;
    } else {
      rightGroups = [];
      for (const g of right) {
        if (g === "") continue;
        const v = parseInt(g, 16);
        if (isNaN(v) || v < 0 || v > 0xffff) return null;
        rightGroups.push(v);
      }
      rightLen = rightGroups.length;
    }

    const leftGroups: number[] = [];
    for (const g of left) {
      if (g === "") continue;
      const v = parseInt(g, 16);
      if (isNaN(v) || v < 0 || v > 0xffff) return null;
      leftGroups.push(v);
    }

    const totalGroups = leftGroups.length + rightLen;
    if (totalGroups > 8) return null;

    const zeroCount = 8 - totalGroups;
    const groups = [...leftGroups, ...Array(zeroCount).fill(0), ...rightGroups];

    for (let i = 0; i < 8; i++) {
      bytes[i * 2] = (groups[i] >> 8) & 0xff;
      bytes[i * 2 + 1] = groups[i] & 0xff;
    }
    return bytes;
  }

  const parts = ip.split(":");
  if (parts.length === 8) {
    for (let i = 0; i < 8; i++) {
      const v = parseInt(parts[i], 16);
      if (isNaN(v) || v < 0 || v > 0xffff) return null;
      bytes[i * 2] = (v >> 8) & 0xff;
      bytes[i * 2 + 1] = v & 0xff;
    }
    return bytes;
  }

  return null;
}

function matchesCidr(clientBytes: Uint8Array, networkBytes: Uint8Array, prefixLen: number): boolean {
  const fullBytes = Math.floor(prefixLen / 8);
  const remainingBits = prefixLen % 8;

  for (let i = 0; i < fullBytes; i++) {
    if (clientBytes[i] !== networkBytes[i]) return false;
  }

  if (remainingBits > 0) {
    const mask = 0xff & (0xff << (8 - remainingBits));
    if ((clientBytes[fullBytes] & mask) !== (networkBytes[fullBytes] & mask)) return false;
  }

  return true;
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
