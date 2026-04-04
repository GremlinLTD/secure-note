import type { FC } from "hono/jsx";
import { Layout } from "./layout";

type CreatePageProps = {
  nonce: string;
  baseUrl: string;
  encryptScript: string;
};

export const CreatePage: FC<CreatePageProps> = ({ nonce, baseUrl, encryptScript }) => {
  const inlineScript = `
${encryptScript}

document.getElementById("create-form").addEventListener("submit", async function(e) {
  e.preventDefault();
  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = "Encrypting…";

  try {
    const secret = document.getElementById("secret").value.trim();
    const password = document.getElementById("password").value;
    const ttl = Number(document.getElementById("ttl").value);

    if (!secret) {
      btn.disabled = false;
      btn.textContent = "Create Secret Link";
      return;
    }

    const title = document.getElementById("title").value.trim() || undefined;
    const burnMsg = document.getElementById("burn-msg").value.trim() || undefined;
    const { c, iv, key } = await encryptSecret(secret, password);

    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ c, iv, pw: password.length > 0, ttl, title, burnMsg }),
    });

    if (!res.ok) {
      throw new Error("Failed to create note");
    }

    const { id } = await res.json();
    const baseUrl = ${JSON.stringify(baseUrl)};
    const url = baseUrl + "/note/" + id + "#" + key;

    document.getElementById("share-url").textContent = url;
    document.getElementById("share-url").setAttribute("href", url);
    document.getElementById("create-form").classList.add("hidden");
    document.getElementById("result").classList.remove("hidden");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Create Secret Link";
    alert("Error: " + err.message);
  }
});

document.getElementById("copy-btn").addEventListener("click", function() {
  const url = document.getElementById("share-url").textContent;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById("copy-btn");
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = "Copy Link"; }, 2000);
  });
});

document.getElementById("new-note-btn").addEventListener("click", function() {
  document.getElementById("result").classList.add("hidden");
  document.getElementById("create-form").classList.remove("hidden");
  document.getElementById("title").value = "";
  document.getElementById("secret").value = "";
  document.getElementById("password").value = "";
  document.getElementById("burn-msg").value = "";
  document.getElementById("submit-btn").disabled = false;
  document.getElementById("submit-btn").textContent = "Create Secret Link";
});

var maxSize = 1048576;
document.getElementById("secret").addEventListener("input", function() {
  var len = new TextEncoder().encode(this.value).length;
  var counter = document.getElementById("size-counter");
  if (len > maxSize * 0.8) {
    counter.textContent = "(" + Math.round(len / 1024) + " KB / " + Math.round(maxSize / 1024) + " KB)";
    counter.className = "size-counter" + (len > maxSize ? " size-over" : "");
  } else {
    counter.textContent = "";
  }
});
`;

  return (
    <Layout title="Gremlin Secure Note" nonce={nonce}>
      <div class="card">
        <h1>Share a Secret</h1>
        <p class="subtitle">Your secret is encrypted in-browser before being stored. Only the recipient with the link can read it. It self-destructs after one view.</p>

        <form id="create-form">
          <div class="form-group">
            <label for="title">Title (optional)</label>
            <input type="text" id="title" name="title" placeholder="e.g. SSH key for production server" maxlength={100} />
          </div>

          <div class="form-group">
            <label for="secret">Secret <span id="size-counter" class="size-counter"></span></label>
            <textarea id="secret" name="secret" placeholder="Enter your secret message..." required></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="password">Password (optional)</label>
              <input type="password" id="password" name="password" placeholder="Extra protection" />
            </div>

            <div class="form-group">
              <label for="ttl">Expires after</label>
              <select id="ttl" name="ttl">
                <option value="3600">1 hour</option>
                <option value="86400">24 hours</option>
                <option value="604800" selected>1 week</option>
                <option value="2592000">30 days</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="burn-msg">Burn message (optional)</label>
            <input type="text" id="burn-msg" name="burn-msg" placeholder="Message shown after viewing" maxlength={200} />
          </div>

          <button type="submit" id="submit-btn" class="btn btn-primary">Create Secret Link</button>
        </form>

        <div id="result" class="hidden">
          <p class="success">Your secret link is ready. Share it once, it will be destroyed after viewing.</p>
          <div class="form-group mt-md">
            <label>Share URL</label>
            <a id="share-url" class="link-box" href="#" target="_blank" rel="noopener noreferrer"></a>
          </div>
          <button id="copy-btn" class="btn btn-primary">Copy Link</button>
          <p class="warning mt-md">This link can only be viewed once. After that, the note is permanently destroyed.</p>
          <button id="new-note-btn" class="btn btn-secondary mt-md">Create Another</button>
        </div>
      </div>

      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: inlineScript }} />
    </Layout>
  );
};
