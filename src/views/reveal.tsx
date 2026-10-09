import type { FC } from "hono/jsx";
import { Layout } from "./layout";

type RevealPageProps = {
  nonce: string;
  noteId: string;
  hasPassword: boolean;
  notFound: boolean;
  decryptScript: string;
  title?: string;
  burnMsg?: string;
  maxViews?: number;
  ipRestricted?: boolean;
  baseUrl: string;
};

export const RevealPage: FC<RevealPageProps> = ({ nonce, noteId, hasPassword, notFound, decryptScript, title, burnMsg, maxViews, ipRestricted, baseUrl }) => {
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
      showGone("not-found");
      return;
    }
    if (res.status === 403) {
      showGone("ip-denied");
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

    // Update burned notice based on remaining views
    var burnedNoticeEl = document.getElementById("burned-notice");
    if (typeof data.viewsRemaining === "number" && data.viewsRemaining > 0) {
      document.getElementById("burned-head").textContent = data.viewsRemaining + " view" + (data.viewsRemaining === 1 ? "" : "s") + " remaining";
      document.getElementById("burned-text").textContent = "After the last view it will be permanently destroyed.";
    }

    document.getElementById("secret-content").textContent = plaintext;
    var form = document.getElementById("reveal-form");
    form.classList.add("fade-out");
    form.addEventListener("animationend", function() {
      form.classList.add("hidden");
      document.getElementById("secret-box").classList.remove("hidden");
      document.getElementById("secret-box").classList.add("fade-in");
      burnedNoticeEl.classList.remove("hidden");
      burnedNoticeEl.classList.add("fade-in");
    }, { once: true });
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Reveal secret";
    if (err.name === "OperationError") {
      const errorEl = document.getElementById("decrypt-error");
      const attemptsEl = document.getElementById("attempts-remaining");
      errorEl.classList.remove("hidden");

      if (attemptsEl) {
        const remaining = parseInt(attemptsEl.dataset.remaining || "0", 10) - 1;
        if (remaining <= 0) {
          showGone("destroyed");
          return;
        }
        attemptsEl.dataset.remaining = String(remaining);
        attemptsEl.textContent = remaining + " of 3 attempts left";
        document.getElementById("password").classList.add("input-error");
        errorEl.textContent = "Wrong password. " + remaining + " attempt" + (remaining === 1 ? "" : "s") + " left.";
      } else {
        errorEl.textContent = "Decryption failed. The note has been destroyed.";
      }
    } else {
      var revealErrEl = document.getElementById("reveal-error");
      revealErrEl.textContent = "Error: " + err.message;
      revealErrEl.classList.remove("hidden");
    }
  }
});

document.getElementById("copy-secret-btn")?.addEventListener("click", function() {
  const text = document.getElementById("secret-content").textContent;
  navigator.clipboard.writeText(text).then(function() {
    const btn = document.getElementById("copy-secret-btn");
    btn.textContent = "Copied";
    setTimeout(function() { btn.textContent = "Copy secret"; }, 2000);
  });
});

document.getElementById("password")?.addEventListener("input", function() {
  this.classList.remove("input-error");
  document.getElementById("decrypt-error").classList.add("hidden");
});

function showGone(id) {
  document.getElementById("note-ui").classList.add("hidden");
  document.getElementById(id).classList.remove("hidden");
}
`;

  const host = baseUrl.replace(/^https?:\/\//, "");
  const shortId = noteId.length > 12 ? `${noteId.slice(0, 4)}…${noteId.slice(-4)}` : noteId;
  const breadcrumb = <p class="eyebrow">{host}/note/{shortId}</p>;

  const gone = (id: string, heading: string, text: string, hidden: boolean) => (
    <div id={id} class={hidden ? "gone hidden" : "gone"}>
      <span class="icon-tile icon-tile-muted"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/></svg></span>
      <h1>{heading}<span class="accent-dot">.</span></h1>
      <p>{text}</p>
      <a href="/" class="btn btn-primary">Share a secret</a>
    </div>
  );
  const notFoundText = "This note does not exist, has already been viewed, or has expired.";

  if (notFound) {
    return (
      <Layout title="Note Not Found — Gremlin Secure Note" nonce={nonce}>
        <div class="reveal-wrap">
          {breadcrumb}
          {gone("not-found", "Note not found", notFoundText, false)}
        </div>
      </Layout>
    );
  }

  const multiView = !hasPassword && !!maxViews && maxViews > 1;
  const intro = hasPassword
    ? "Enter the password the sender gave you. You have three attempts before the note is destroyed."
    : multiView && ipRestricted
      ? `This note can be viewed ${maxViews} times, and only from approved IP addresses.`
      : multiView
        ? `This note can be viewed ${maxViews} times before it is destroyed.`
        : "This note will be permanently destroyed after you reveal it. Make sure you’re ready to copy it.";

  return (
    <Layout title="Reveal Secure Note — Gremlin Secure Note" nonce={nonce}>
      <div class="reveal-wrap">
        {breadcrumb}

        <div id="note-ui" class="stack">
          <div class="note-head">
            <span class="icon-tile icon-tile-dark"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg></span>
            <span class="note-head-text">
              <span class="note-from">Someone sent you a secure note</span>
              <span class="note-title">{title || "Secure Note"}</span>
            </span>
          </div>

          <div class="chips">
            {hasPassword && <span class="chip"><span class="chip-dot dot-indigo"></span>Password protected</span>}
            {ipRestricted && <span class="chip"><span class="chip-dot dot-sky"></span>IP restricted</span>}
            {multiView
              ? <span class="chip"><span class="chip-dot dot-amber"></span>{maxViews} views</span>
              : <span class="chip"><span class="chip-dot dot-coral"></span>Burns after reading</span>}
          </div>

          <form id="reveal-form" class="panel reveal-panel">
            <p class="reveal-intro">{intro}</p>
            {hasPassword && (
              <div class="field">
                <span class="field-label-row">
                  <label for="password" class="field-label">Password</label>
                  <span id="attempts-remaining" class="attempts-label" data-remaining="3">3 of 3 attempts left</span>
                </span>
                <input type="password" id="password" name="password" placeholder="Enter the password you were given" />
              </div>
            )}
            <p id="decrypt-error" role="alert" class="error-text hidden"></p>
            <button type="submit" id="reveal-btn" class="btn btn-danger btn-block">Reveal secret</button>
            <p id="reveal-error" role="alert" class="error-text hidden"></p>
          </form>

          <div id="secret-box" class="stack-sm hidden">
            <pre class="secret-box" id="secret-content"></pre>
            <div><button id="copy-secret-btn" type="button" class="btn btn-primary">Copy secret</button></div>
          </div>

          <div id="burned-notice" class="burned-notice hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 2 2s1-3.5 1-7z"/></svg>
            <span class="step-body">
              <span id="burned-head" class="burned-head">This note has been destroyed</span>
              <span id="burned-text" class="burned-text">{burnMsg ?? "It has been permanently deleted and cannot be viewed again."}</span>
            </span>
          </div>
        </div>

        {gone("not-found", "Note not found", notFoundText, true)}
        {gone("ip-denied", "Access denied", "This note is restricted to specific IP addresses, and yours isn’t one of them.", true)}
        {gone("destroyed", "Note destroyed", "Too many wrong passwords. The note has been permanently destroyed. Ask the sender to share it again.", true)}
      </div>

      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: inlineScript }} />
    </Layout>
  );
};
