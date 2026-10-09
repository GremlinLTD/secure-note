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
    const ttl = Number(document.querySelector('input[name="ttl"]:checked').value);

    if (!secret) {
      btn.disabled = false;
      btn.textContent = "Create secret link";
      var emptyErr = document.getElementById("create-error");
      emptyErr.textContent = "Add a secret to share.";
      emptyErr.classList.remove("hidden");
      return;
    }

    const title = document.getElementById("title").value.trim() || undefined;
    const burnMsg = document.getElementById("burn-msg").value.trim() || undefined;
    const hasPw = password.length > 0;
    const maxViews = hasPw ? 1 : Number(document.querySelector('input[name="max-views"]:checked').value);
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
    var ttlLabel = document.querySelector('label[for="ttl-' + ttl + '"]').textContent;
    var chips = ["Expires in " + ttlLabel, maxViews === 1 ? "Burns after 1 view" : "Burns after " + maxViews + " views"];
    if (hasPw) chips.push("Password protected");
    if (allowedIps) chips.push("IP restricted");
    var summaryEl = document.getElementById("result-summary");
    summaryEl.textContent = "";
    chips.forEach(function(label) {
      var chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = label;
      summaryEl.appendChild(chip);
    });
    document.getElementById("result-note").textContent = hasPw
      ? "Send the password separately, by a different channel. The note is destroyed after it\u2019s read or after three wrong passwords."
      : maxViews === 1
        ? "This link can only be viewed once. After that, the note is permanently destroyed."
        : "This link can be viewed " + maxViews + " times. After that, the note is permanently destroyed.";
    document.getElementById("create-form").classList.add("hidden");
    document.getElementById("result").classList.remove("hidden");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Create secret link";
    var errEl = document.getElementById("create-error");
    errEl.textContent = "Error: " + err.message;
    errEl.classList.remove("hidden");
  }
});

document.getElementById("copy-btn").addEventListener("click", function() {
  const url = document.getElementById("share-url").textContent;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById("copy-btn");
    btn.textContent = "Copied";
    setTimeout(() => { btn.textContent = "Copy link"; }, 2000);
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
  document.getElementById("views-1").checked = true;
  document.getElementById("views-group").classList.remove("hidden");
  document.getElementById("views-pw-note").classList.add("hidden");
  document.getElementById("advanced").open = false;
  document.getElementById("submit-btn").disabled = false;
  document.getElementById("submit-btn").textContent = "Create secret link";
});

document.getElementById("password").addEventListener("input", function() {
  document.getElementById("views-group").classList.toggle("hidden", this.value.length > 0);
  document.getElementById("views-pw-note").classList.toggle("hidden", this.value.length === 0);
});

var maxSize = 1048576;
document.getElementById("secret").addEventListener("input", function() {
  document.getElementById("create-error").classList.add("hidden");
  var len = new TextEncoder().encode(this.value).length;
  var counter = document.getElementById("size-counter");
  if (len > maxSize * 0.8) {
    counter.textContent = Math.round(len / 1024) + " KB / " + Math.round(maxSize / 1024) + " KB";
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
    el.textContent = s.created.toLocaleString("en-GB") + " secret" + (s.created === 1 ? "" : "s") + " shared securely";
    el.classList.remove("hidden");
  }
}).catch(function() {});
`;

  const host = baseUrl.replace(/^https?:\/\//, "");
  const ttls: [number, string][] = [[3600, "1 hour"], [86400, "24 hours"], [604800, "1 week"], [2592000, "30 days"]];
  const views = [1, 2, 3, 4, 5];

  return (
    <Layout title="Gremlin Secure Note" nonce={nonce}>
      <div class="create-wrap">
        <div class="create-main">
          {host && <p class="eyebrow">{host}</p>}
          <h1 class="page-title">Share a secret<span class="accent-dot">.</span></h1>
          <p class="lede">Your secret is encrypted in-browser before being stored. Only the recipient with the link can read it. It self-destructs after one view.</p>

          <form id="create-form" class="stack" novalidate>
            <div class="field">
              <label for="title" class="field-label">Title <span class="field-hint">(optional, shown before reveal)</span></label>
              <input type="text" id="title" name="title" placeholder="e.g. SSH key for production server" maxlength={100} />
            </div>

            <div class="field">
              <span class="field-label-row">
                <label for="secret" class="field-label">Secret <span class="required">*</span></label>
                <span id="size-counter" class="size-counter"></span>
              </span>
              <textarea id="secret" name="secret" rows={7} placeholder="Paste a password, API key, or anything else"></textarea>
            </div>

            <div class="field-grid">
              <div class="field">
                <label for="password" class="field-label">Password <span class="field-hint">(optional)</span></label>
                <input type="password" id="password" name="password" placeholder="Extra protection" autocomplete="new-password" />
                <span class="field-help">Send it separately. Three wrong tries and the note is destroyed.</span>
              </div>

              <fieldset class="field">
                <legend class="field-label">Expires after</legend>
                <div class="segmented segmented-4">
                  {ttls.map(([value, label]) => (
                    <>
                      <input type="radio" name="ttl" id={`ttl-${value}`} value={String(value)} checked={value === 604800} />
                      <label for={`ttl-${value}`}>{label}</label>
                    </>
                  ))}
                </div>
              </fieldset>
            </div>

            <details id="advanced" class="advanced">
              <summary>Advanced options</summary>
              <div class="advanced-content stack">
                <fieldset class="field">
                  <legend class="field-label">Views before it burns</legend>
                  <div id="views-group" class="segmented segmented-5">
                    {views.map((n) => (
                      <>
                        <input type="radio" name="max-views" id={`views-${n}`} value={String(n)} checked={n === 1} />
                        <label for={`views-${n}`}>{n}</label>
                      </>
                    ))}
                  </div>
                  <span id="views-pw-note" class="muted-text hidden">Password notes can be viewed once.</span>
                </fieldset>

                <div class="field">
                  <label for="burn-msg" class="field-label">Burn message <span class="field-hint">(shown after it's read)</span></label>
                  <input type="text" id="burn-msg" name="burn-msg" placeholder="e.g. Rotate this key once you've stored it" maxlength={200} />
                </div>

                <div class="field">
                  <label for="allowed-ips" class="field-label">Restrict to IP addresses</label>
                  <input type="text" id="allowed-ips" name="allowed-ips" class="input-mono" placeholder="203.0.113.0/24, 10.0.0.5" />
                  <span class="field-help">IPv4, IPv6 or CIDR ranges, separated by commas. Up to 10.</span>
                </div>
              </div>
            </details>

            <div class="stack-sm">
              <button type="submit" id="submit-btn" class="btn btn-primary btn-block">Create secret link</button>
              <p id="create-error" role="alert" class="error-text hidden"></p>
            </div>
          </form>

          <div id="result" class="stack hidden">
            <div class="result-head">
              <span class="check-badge"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
              <span>Your secret link is ready.</span>
            </div>
            <div class="result-panel">
              <a id="share-url" class="link-box" href="#" target="_blank" rel="noopener noreferrer"></a>
              <div class="result-actions">
                <button id="copy-btn" type="button" class="btn btn-primary">Copy link</button>
                <span id="result-summary" class="chips"></span>
              </div>
            </div>
            <p id="result-note" class="result-note"></p>
            <div><button id="new-note-btn" type="button" class="btn btn-outline">Create another</button></div>
          </div>
        </div>

        <aside class="aside">
          <div id="how" class="panel">
            <p class="aside-eyebrow">How it works</p>
            <ol class="steps">
              <li><span class="step-num">1</span><span class="step-body"><span class="step-title">Encrypted in your browser</span><span class="step-text">AES-256-GCM, before anything is sent. The server only stores encrypted bytes.</span></span></li>
              <li><span class="step-num">2</span><span class="step-body"><span class="step-title">The key stays in the link</span><span class="step-text">It sits after the <span class="mono">#</span>, which browsers never send to the server.</span></span></li>
              <li><span class="step-num">3</span><span class="step-body"><span class="step-title">Destroyed after reading</span><span class="step-text">Or when it expires, whichever comes first.</span></span></li>
            </ol>
          </div>
          <div id="cli" class="cli-card">
            <span class="step-title">From the terminal</span>
            <pre class="code-block"><span class="code-prompt">$</span> echo "my-api-key-123" | gremlin-secret</pre>
            <span class="cli-links">
              <a href="/cli.sh">Download cli.sh</a>
              <a href="https://github.com/GremlinLTD/secure-note/releases">Rust binary</a>
              <a href="/api/docs">API docs</a>
            </span>
          </div>
          <p id="stats-count" class="stats-count hidden"></p>
        </aside>
      </div>

      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: inlineScript }} />
    </Layout>
  );
};
