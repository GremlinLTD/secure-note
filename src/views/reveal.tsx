import type { FC } from "hono/jsx";
import { Layout } from "./layout";

type RevealPageProps = {
  nonce: string;
  noteId: string;
  hasPassword: boolean;
  notFound: boolean;
  decryptScript: string;
};

export const RevealPage: FC<RevealPageProps> = ({ nonce, noteId, hasPassword, notFound, decryptScript }) => {
  const inlineScript = `
${decryptScript}

document.getElementById("reveal-btn")?.addEventListener("click", async function() {
  const btn = document.getElementById("reveal-btn");
  btn.disabled = true;
  btn.textContent = "Decrypting…";

  try {
    const rawKeyB64 = window.location.hash.slice(1);
    if (!rawKeyB64) {
      throw new Error("No key found in URL fragment.");
    }

    const password = document.getElementById("password")?.value || "";

    const noteId = ${JSON.stringify(noteId)};
    const res = await fetch("/api/notes/" + encodeURIComponent(noteId));
    if (res.status === 404) {
      document.getElementById("note-ui").classList.add("hidden");
      document.getElementById("not-found").classList.remove("hidden");
      return;
    }
    if (!res.ok) {
      throw new Error("Failed to fetch note.");
    }

    const { c, iv } = await res.json();
    const plaintext = await decryptSecret(c, iv, rawKeyB64, password);

    document.getElementById("secret-content").textContent = plaintext;
    document.getElementById("secret-box").classList.remove("hidden");
    document.getElementById("reveal-form").classList.add("hidden");
    document.getElementById("burned-notice").classList.remove("hidden");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Reveal Secret";
    if (err.name === "OperationError") {
      document.getElementById("decrypt-error").classList.remove("hidden");
    } else {
      alert("Error: " + err.message);
    }
  }
});
`;

  if (notFound) {
    return (
      <Layout title="Note Not Found — Gremlin Secure Note" nonce={nonce}>
        <div class="card">
          <div class="burned-msg">
            <h2>Note Not Found</h2>
            <p>This note does not exist, has already been viewed, or has expired.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Reveal Secure Note — Gremlin Secure Note" nonce={nonce}>
      <div class="card">
        <div id="note-ui">
          <h1>Secure Note</h1>
          <p class="subtitle">You have received a secure note. It will be permanently destroyed after you reveal it.</p>

          <div id="reveal-form">
            {hasPassword && (
              <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" placeholder="Enter the password to decrypt" />
              </div>
            )}

            <p id="decrypt-error" class="warning hidden">Decryption failed. The password may be incorrect or the link may be corrupted. The note has been destroyed.</p>

            <button id="reveal-btn" class="btn btn-danger">Reveal Secret</button>
          </div>

          <div id="secret-box" class="hidden">
            <div class="secret-box" id="secret-content"></div>
          </div>

          <div id="burned-notice" class="hidden">
            <p class="warning" style="margin-top:16px;">This note has been permanently destroyed and cannot be viewed again.</p>
          </div>
        </div>

        <div id="not-found" class="hidden">
          <div class="burned-msg">
            <h2>Note Not Found</h2>
            <p>This note does not exist, has already been viewed, or has expired.</p>
          </div>
        </div>
      </div>

      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: inlineScript }} />
    </Layout>
  );
};
