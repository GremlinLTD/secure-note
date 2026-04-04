import { Hono } from "hono";

import type { Bindings } from "../types";
import { getNoteMetadata } from "../kv";
import { CreatePage } from "../views/create";
import { RevealPage } from "../views/reveal";
import { getEncryptScript, getDecryptScript } from "../crypto";
import { CLI_SCRIPT } from "../cli-script";

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

pages.get("/cli.sh", (c) => {
  const script = CLI_SCRIPT.replace(
    "https://secure.gremlin.group",
    c.env.BASE_URL || "https://secure.gremlin.group"
  );
  return new Response(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="gremlin-secret.sh"',
    },
  });
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

pages.get("/note/:id", async (c) => {
  const nonce = generateNonce();
  const { id } = c.req.param();
  c.header("Content-Security-Policy", cspHeader(nonce));

  if (!UUID_RE.test(id)) {
    return c.html(
      RevealPage({ nonce, noteId: id, hasPassword: false, notFound: true, decryptScript: getDecryptScript() }) as any,
      404
    );
  }

  const meta = await getNoteMetadata(c.env.NOTES, id);

  if (!meta) {
    return c.html(
      RevealPage({ nonce, noteId: id, hasPassword: false, notFound: true, decryptScript: getDecryptScript() }) as any,
      404
    );
  }

  return c.html(
    RevealPage({ nonce, noteId: id, hasPassword: meta.pw, notFound: false, decryptScript: getDecryptScript(), title: meta.title, burnMsg: meta.burnMsg, maxViews: meta.maxViews }) as any
  );
});
