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
  document.getElementById("create-error").classList.add("hidden");
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
    const hasPw = password.length > 0;
    const maxViewsEl = document.getElementById("max-views");
    const maxViews = (!hasPw && maxViewsEl) ? Number(maxViewsEl.value) : 1;
    const allowedIpsRaw = document.getElementById("allowed-ips").value.trim();
    const allowedIps = allowedIpsRaw ? allowedIpsRaw.split(",").map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; }) : undefined;
    const { c, iv, key } = await encryptSecret(secret, password);

    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ c, iv, pw: hasPw, ttl, title, burnMsg, maxViews, allowedIps }),
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
    var errEl = document.getElementById("create-error");
    errEl.textContent = "Error: " + err.message;
    errEl.classList.remove("hidden");
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
  document.getElementById("allowed-ips").value = "";
  var maxViewsEl = document.getElementById("max-views");
  if (maxViewsEl) { maxViewsEl.value = "1"; }
  var viewsGroup = document.getElementById("views-group");
  if (viewsGroup) { viewsGroup.classList.remove("hidden"); }
  document.getElementById("submit-btn").disabled = false;
  document.getElementById("submit-btn").textContent = "Create Secret Link";
});

document.getElementById("password").addEventListener("input", function() {
  var viewsGroup = document.getElementById("views-group");
  if (viewsGroup) {
    viewsGroup.classList.toggle("hidden", this.value.length > 0);
  }
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

fetch("/api/stats").then(function(r) {
  return r.json();
}).then(function(s) {
  var el = document.getElementById("stats-count");
  if (el && s.created > 0) {
    el.textContent = s.created + " secret" + (s.created === 1 ? "" : "s") + " shared securely";
    el.classList.remove("hidden");
  }
}).catch(function() {});
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
            <label for="secret">Secret <span class="required">*</span> <span id="size-counter" class="size-counter"></span></label>
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

            <div class="form-group" id="views-group">
              <label for="max-views">Views</label>
              <select id="max-views" name="max-views">
                <option value="1" selected>1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="burn-msg">Burn message (optional)</label>
            <input type="text" id="burn-msg" name="burn-msg" placeholder="Message shown after viewing" maxlength={200} />
          </div>

          <div class="form-group">
            <label for="allowed-ips">Restrict to IPs (optional)</label>
            <input type="text" id="allowed-ips" name="allowed-ips" placeholder="e.g., 203.0.113.0/24, 10.0.0.5" />
          </div>

          <button type="submit" id="submit-btn" class="btn btn-primary">Create Secret Link</button>
          <p id="create-error" class="warning hidden"></p>
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

      <p id="stats-count" class="stats-count hidden"></p>

      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: inlineScript }} />
    </Layout>
  );
};
