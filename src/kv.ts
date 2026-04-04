export interface NoteData {
  c: string;
  iv: string;
  pw: boolean;
  ts: number;
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
