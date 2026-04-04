export function getEncryptScript(): string {
  return `
async function encryptSecret(plaintext, password) {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));

  let aesKey;
  if (password) {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    aesKey = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: rawKey, iterations: 600000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );
  } else {
    aesKey = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, aesKey, encoded);

  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const toB64url = (buf) => toB64(buf).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=/g, "");

  return {
    c: toB64(cipherBuf),
    iv: toB64(new Uint8Array(iv)),
    key: toB64url(rawKey),
  };
}
`;
}

export function getDecryptScript(): string {
  return `
async function decryptSecret(c, iv, rawKeyB64, password) {
  const fromB64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
  const fromB64url = (s) => {
    const base = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (base.length % 4)) % 4;
    return fromB64(base + "=".repeat(pad));
  };

  const rawKey = fromB64url(rawKeyB64);

  let aesKey;
  if (password) {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    aesKey = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: rawKey, iterations: 600000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  } else {
    aesKey = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  }

  const cipherBuf = fromB64(c);
  const ivBuf = fromB64(iv);

  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuf, tagLength: 128 }, aesKey, cipherBuf);
  return new TextDecoder().decode(plainBuf);
}
`;
}
