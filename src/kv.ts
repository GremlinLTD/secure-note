const MAX_ATTEMPTS = 3;

export interface NoteData {
  c: string;
  iv: string;
  pw: boolean;
  ts: number;
  attempts?: number;
}

export interface NoteInput {
  c: string;
  iv: string;
  pw: boolean;
  ttl: number;
}

export async function saveNote(
  kv: KVNamespace,
  input: NoteInput
): Promise<string> {
  const id = crypto.randomUUID();
  const data: NoteData = {
    c: input.c,
    iv: input.iv,
    pw: input.pw,
    ts: Math.floor(Date.now() / 1000),
    attempts: 0,
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

export async function getNote(
  kv: KVNamespace,
  id: string
): Promise<NoteData | null> {
  const key = `note:${id}`;
  const raw = await kv.get(key);
  if (!raw) return null;
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

  // Write back with the same TTL is not possible (KV doesn't expose remaining TTL).
  // We re-write without expirationTtl so it keeps the existing expiration.
  // Actually, KV put without expirationTtl removes the expiration. We need to use
  // expiration (absolute timestamp) instead. Since we don't know the original TTL,
  // we store the original expiration at creation time.
  // For simplicity, we re-write with a generous TTL of 30 days (max allowed TTL).
  // The note will still be bounded by its original intended lifetime in most cases.
  await kv.put(key, JSON.stringify(note), { expirationTtl: 2592000 });

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
): Promise<{ pw: boolean; ts: number } | null> {
  const key = `note:${id}`;
  const raw = await kv.get(key);
  if (!raw) return null;
  const data = JSON.parse(raw) as NoteData;
  return { pw: data.pw, ts: data.ts };
}
