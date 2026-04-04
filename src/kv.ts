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
}

export interface NoteInput {
  c: string;
  iv: string;
  pw: boolean;
  ttl: number;
  title?: string;
  burnMsg?: string;
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
    ...(input.title ? { title: input.title } : {}),
    ...(input.burnMsg ? { burnMsg: input.burnMsg } : {}),
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
): Promise<{ pw: boolean; ts: number; title?: string; burnMsg?: string } | null> {
  const key = `note:${id}`;
  const raw = await kv.get(key);
  if (!raw) return null;
  const data = JSON.parse(raw) as NoteData;
  return {
    pw: data.pw,
    ts: data.ts,
    ...(data.title ? { title: data.title } : {}),
    ...(data.burnMsg ? { burnMsg: data.burnMsg } : {}),
  };
}
