import { Hono } from "hono";
import { html } from "hono/html";
import type { Bindings } from "../types";
import { getNoteMetadata } from "../kv";
import { CreatePage } from "../views/create";
import { RevealPage } from "../views/reveal";
import { getEncryptScript, getDecryptScript } from "../crypto";

type Env = { Bindings: Bindings };

export const pages = new Hono<Env>();

function generateNonce(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf));
}

function cspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    "connect-src 'self'",
    "img-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

pages.get("/", (c) => {
  const nonce = generateNonce();
  const baseUrl = c.env.BASE_URL ?? "";
  c.header("Content-Security-Policy", cspHeader(nonce));
  return c.html(
    CreatePage({ nonce, baseUrl, encryptScript: getEncryptScript() }) as any
  );
});

pages.get("/note/:id", async (c) => {
  const nonce = generateNonce();
  const { id } = c.req.param();
  c.header("Content-Security-Policy", cspHeader(nonce));

  const meta = await getNoteMetadata(c.env.NOTES, id);

  if (!meta) {
    return c.html(
      RevealPage({ nonce, noteId: id, hasPassword: false, notFound: true, decryptScript: getDecryptScript() }) as any,
      404
    );
  }

  return c.html(
    RevealPage({ nonce, noteId: id, hasPassword: meta.pw, notFound: false, decryptScript: getDecryptScript() }) as any
  );
});
