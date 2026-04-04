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

    const { c, iv, key } = await encryptSecret(secret, password);

    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ c, iv, pw: password.length > 0, ttl }),
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
    setTimeout(() => { btn.textContent = "Copy"; }, 2000);
  });
});
`;

  return (
    <Layout title="Gremlin Secure Note" nonce={nonce}>
      <div class="card">
        <h1>Share a Secret</h1>
        <p class="subtitle">Your secret is encrypted in-browser before being stored. Only the recipient with the link can read it. It self-destructs after one view.</p>

        <form id="create-form">
          <div class="form-group">
            <label for="secret">Secret</label>
            <textarea id="secret" name="secret" placeholder="Enter your secret message..." required></textarea>
          </div>

          <div class="form-group">
            <label for="password">Password (optional)</label>
            <input type="password" id="password" name="password" placeholder="Leave blank for no password" />
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

          <button type="submit" id="submit-btn" class="btn btn-primary">Create Secret Link</button>
        </form>

        <div id="result" class="hidden">
          <p class="success">Your secret link is ready. Share it once — it will be destroyed after viewing.</p>
          <div class="form-group" style="margin-top:16px;">
            <label>Share URL</label>
            <div class="row">
              <a id="share-url" class="link-box" href="#" target="_blank" rel="noopener noreferrer"></a>
              <button id="copy-btn" class="btn btn-primary">Copy</button>
            </div>
          </div>
        </div>
      </div>

      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: inlineScript }} />
    </Layout>
  );
};
