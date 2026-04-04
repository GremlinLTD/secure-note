import type { FC } from "hono/jsx";
import { Layout } from "./layout";

type RevealPageProps = {
  nonce: string;
  noteId: string;
  hasPassword: boolean;
  notFound: boolean;
  decryptScript: string;
  title?: string;
};

export const RevealPage: FC<RevealPageProps> = ({ nonce, noteId, hasPassword, notFound, decryptScript, title }) => {
  const inlineScript = `
${decryptScript}

document.getElementById("reveal-form")?.addEventListener("submit", async function(e) {
  e.preventDefault();
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
    const hasPassword = ${JSON.stringify(hasPassword)};

    const res = await fetch("/api/notes/" + encodeURIComponent(noteId));
    if (res.status === 404) {
      document.getElementById("note-ui").classList.add("hidden");
      document.getElementById("not-found").classList.remove("hidden");
      return;
    }
    if (!res.ok) {
      throw new Error("Failed to fetch note.");
    }

    const data = await res.json();
    const plaintext = await decryptSecret(data.c, data.iv, rawKeyB64, password);

    // Decryption succeeded -- burn the note if password-protected
    // (non-password notes are already burned by the GET)
    if (hasPassword) {
      await fetch("/api/notes/" + encodeURIComponent(noteId), { method: "DELETE" });
    }

    document.getElementById("secret-content").textContent = plaintext;
    var form = document.getElementById("reveal-form");
    form.classList.add("fade-out");
    form.addEventListener("animationend", function() {
      form.classList.add("hidden");
      document.getElementById("secret-box").classList.remove("hidden");
      document.getElementById("secret-box").classList.add("fade-in");
      document.getElementById("burned-notice").classList.remove("hidden");
      document.getElementById("burned-notice").classList.add("fade-in");
    }, { once: true });
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Reveal Secret";
    if (err.name === "OperationError") {
      const errorEl = document.getElementById("decrypt-error");
      const attemptsEl = document.getElementById("attempts-remaining");
      errorEl.classList.remove("hidden");

      if (attemptsEl) {
        const remaining = parseInt(attemptsEl.dataset.remaining || "0", 10) - 1;
        attemptsEl.dataset.remaining = String(remaining);
        if (remaining <= 0) {
          errorEl.textContent = "Too many failed attempts. The note has been permanently destroyed.";
          btn.disabled = true;
        } else {
          errorEl.textContent = "Wrong password. " + remaining + " attempt" + (remaining === 1 ? "" : "s") + " remaining.";
        }
      } else {
        errorEl.textContent = "Decryption failed. The note has been destroyed.";
      }
    } else {
      alert("Error: " + err.message);
    }
  }
});

document.getElementById("copy-secret-btn")?.addEventListener("click", function() {
  const text = document.getElementById("secret-content").textContent;
  navigator.clipboard.writeText(text).then(function() {
    const btn = document.getElementById("copy-secret-btn");
    btn.textContent = "Copied!";
    setTimeout(function() { btn.textContent = "Copy Secret"; }, 2000);
  });
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
          {title && <h2 class="note-title">{title}</h2>}
          <p class="subtitle">
            {hasPassword
              ? "You have received a password-protected secure note. You have 3 attempts to enter the correct password."
              : "You have received a secure note. It will be permanently destroyed after you reveal it."}
          </p>

          <form id="reveal-form">
            {hasPassword && (
              <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" placeholder="Enter the password to decrypt" />
              </div>
            )}

            <p id="decrypt-error" class="warning hidden"></p>
            {hasPassword && <span id="attempts-remaining" class="hidden" data-remaining="3"></span>}

            <button type="submit" id="reveal-btn" class="btn btn-danger">Reveal Secret</button>
          </form>

          <div id="secret-box" class="hidden">
            <div class="secret-box" id="secret-content"></div>
            <button id="copy-secret-btn" class="btn btn-primary mt-md">Copy Secret</button>
          </div>

          <div id="burned-notice" class="hidden">
            <p class="warning mt-md">This note has been permanently destroyed and cannot be viewed again.</p>
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
