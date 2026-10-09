import type { FC, PropsWithChildren } from "hono/jsx";
import { raw } from "hono/html";

type LayoutProps = PropsWithChildren<{
  title: string;
  nonce: string;
}>;

export const Layout: FC<LayoutProps> = ({ title, nonce, children }) => {
  return (
    <>
    {raw('<!DOCTYPE html>')}
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t);else if(window.matchMedia("(prefers-color-scheme: light)").matches)document.documentElement.setAttribute("data-theme","light");})();` }} />
        <style nonce={nonce} dangerouslySetInnerHTML={{ __html: `
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          :root {
            --bg: #0A0D1A;
            --s1: #141829;
            --s2: #1F2437;
            --bd: #2A3142;
            --tx: #E8EBF0;
            --tx2: #A8B2C7;
            --tx3: #848CA0;
            --ac: #00E5BB;
            --act: #00E5BB;
            --on: #0A0D1A;
            --in: #1F2437;
            --err: #FF6B6B;
            --seg-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
            --mono: "SF Mono", Monaco, Consolas, monospace;
            color-scheme: dark;
          }

          [data-theme=light] {
            --bg: #FFFFFF;
            --s1: #F7F9FB;
            --s2: #EFF1F5;
            --bd: #E2E7F1;
            --tx: #1A1F36;
            --tx2: #556178;
            --tx3: #5F6B84;
            --ac: #00D4AA;
            --act: #007A65;
            --on: #1A1F36;
            --in: #FFFFFF;
            --err: #D64545;
            --seg-shadow: 0 1px 3px rgba(26, 31, 54, 0.14);
            color-scheme: light;
          }

          body {
            background: var(--bg);
            color: var(--tx);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            line-height: 1.5;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }

          a { color: var(--act); text-decoration: none; }
          a:hover { color: #00D4AA; }
          a:focus-visible, button:focus-visible { outline: 2px solid #00D4AA; outline-offset: 2px; }

          .mono { font-family: var(--mono); }
          .teal-dot { color: #00D4AA; }
          .accent-dot { color: var(--ac); }
          .hidden { display: none !important; }

          .site-header { border-bottom: 1px solid var(--bd); }
          .site-header-inner {
            max-width: 1080px;
            margin: 0 auto;
            padding: 18px 24px;
            display: flex;
            align-items: center;
            gap: 16px 24px;
            flex-wrap: wrap;
          }
          .brand { display: flex; align-items: center; gap: 14px; color: var(--tx); }
          .brand:hover { color: var(--tx); }
          .brand-logo { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
          .brand-divider { width: 1px; height: 24px; background: var(--bd); }
          .brand-name { font-size: 18px; font-weight: 600; }
          .site-nav { margin-left: auto; display: flex; align-items: center; gap: 8px 28px; flex-wrap: wrap; }
          .site-nav a { font-size: 16px; font-weight: 500; color: var(--tx); }
          .site-nav a:hover { color: #00D4AA; }

          .theme-toggle {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            border: 1px solid var(--bd);
            background: var(--bg);
            color: var(--tx2);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: border-color 0.2s;
          }
          .theme-toggle:hover { border-color: #00D4AA; }
          .icon-moon { display: none; }
          [data-theme=light] .icon-sun { display: none; }
          [data-theme=light] .icon-moon { display: inline; }

          main { flex: 1; }

          .site-footer { border-top: 1px solid var(--bd); }
          .site-footer-inner {
            max-width: 1080px;
            margin: 0 auto;
            padding: 24px;
            display: flex;
            gap: 8px 24px;
            flex-wrap: wrap;
            align-items: center;
            font-size: 14px;
            color: var(--tx3);
          }
          .site-footer-inner .powered a { font-weight: 600; color: var(--tx); }
          .footer-links { margin-left: auto; display: flex; gap: 20px; flex-wrap: wrap; }

          .eyebrow { font-family: var(--mono); font-size: 14px; color: var(--tx2); margin-bottom: 20px; word-break: break-all; }

          .field { display: flex; flex-direction: column; gap: 8px; }
          fieldset { border: none; min-width: 0; }
          legend.field-label { padding: 0; margin-bottom: 8px; }
          .field-label { font-size: 15px; font-weight: 600; color: var(--tx); }
          .field-label-row { display: flex; justify-content: space-between; gap: 12px; }
          .field-hint { font-weight: 400; color: var(--tx3); }
          .field-help { font-size: 13px; line-height: 1.5; color: var(--tx3); }
          .required { color: #FF6B6B; }

          input[type=text],
          input[type=password],
          textarea {
            width: 100%;
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid var(--bd);
            background: var(--in);
            color: var(--tx);
            font-size: 16px;
            font-family: inherit;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
          }
          input::placeholder, textarea::placeholder { color: var(--tx3); }
          input:focus, textarea:focus { border-color: #00D4AA; box-shadow: 0 0 0 3px rgba(0, 212, 170, 0.18); }
          input.input-error { border-color: var(--err); }
          textarea {
            padding: 14px 16px;
            font-size: 15px;
            line-height: 1.55;
            font-family: var(--mono);
            resize: vertical;
            min-height: 160px;
          }
          .input-mono { font-family: var(--mono); font-size: 15px; }

          .segmented {
            display: grid;
            background: var(--s2);
            border-radius: 10px;
            padding: 4px;
            gap: 4px;
            border: none;
          }
          .segmented-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .segmented-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); max-width: 320px; }
          .segmented input { position: absolute; opacity: 0; pointer-events: none; }
          .segmented label {
            padding: 9px 4px;
            border-radius: 7px;
            text-align: center;
            color: var(--tx2);
            font-weight: 500;
            font-size: 14px;
            cursor: pointer;
          }
          .segmented input:checked + label { background: var(--bg); color: var(--tx); font-weight: 600; box-shadow: var(--seg-shadow); }
          .segmented input:focus-visible + label { outline: 2px solid #00D4AA; outline-offset: 1px; }

          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 12px 25px;
            border-radius: 30px;
            font-size: 16px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            transition: opacity 0.15s;
          }
          .btn-block { width: 100%; padding: 14px 25px; }
          .btn:disabled { opacity: 0.6; cursor: not-allowed; }
          .btn-primary { background: var(--ac); border: 1px solid var(--ac); border-bottom: 3px solid #00BB96; color: var(--on); }
          .btn-primary:hover { color: var(--on); }
          .btn-danger { background: #FF6B6B; border: 1px solid #FF6B6B; border-bottom: 3px solid #E25555; color: #1A1F36; }
          .btn-outline { background: none; border: 1px solid var(--act); color: var(--act); font-weight: 500; }

          .error-text { font-size: 14px; color: var(--err); }

          .chips { display: flex; gap: 8px; flex-wrap: wrap; }
          .chip { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--tx2); background: var(--s2); border-radius: 9999px; padding: 4px 12px; }
          .chip-dot { width: 8px; height: 8px; border-radius: 50%; }
          .dot-indigo { background: #6366F1; }
          .dot-coral { background: #FF6B6B; }
          .dot-sky { background: #0EA5E9; }
          .dot-amber { background: #FFB84D; }

          .panel { background: var(--s1); border-radius: 12px; padding: 28px; }

          .code-block {
            background: #1A1F36;
            color: #E8EBF0;
            border-radius: 8px;
            padding: 14px 16px;
            font-family: var(--mono);
            font-size: 13px;
            line-height: 1.6;
            overflow: auto;
          }
          .code-prompt { color: #95A1B5; }

          .icon-tile { flex: none; width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
          .icon-tile-dark { background: #1A1F36; }
          .icon-tile-muted { background: var(--s2); color: var(--tx2); }

          .create-wrap {
            max-width: 1080px;
            margin: 0 auto;
            padding: clamp(40px, 7vw, 72px) 24px 80px;
            display: flex;
            flex-wrap: wrap;
            gap: 48px 56px;
            align-items: flex-start;
          }
          .create-main { flex: 1 1 480px; min-width: 0; max-width: 640px; }
          .page-title { font-size: clamp(36px, 5.5vw, 52px); font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 16px; }
          .lede { font-size: clamp(17px, 2vw, 19px); line-height: 1.6; color: var(--tx2); margin-bottom: 36px; max-width: 560px; text-wrap: pretty; }
          .stack { display: flex; flex-direction: column; gap: 22px; }
          .stack-sm { display: flex; flex-direction: column; gap: 12px; }
          .field-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 22px; }
          .size-counter { font-family: var(--mono); font-size: 13px; color: var(--tx3); }
          .size-over { color: var(--err); }
          .muted-text { font-size: 14px; color: var(--tx2); }

          .advanced { border-top: 1px solid var(--bd); border-bottom: 1px solid var(--bd); }
          .advanced summary {
            list-style: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
          }
          .advanced summary::-webkit-details-marker { display: none; }
          .advanced summary::after { content: "+"; font-size: 18px; font-weight: 400; color: var(--tx2); }
          .advanced[open] summary::after { content: "\\2212"; }
          .advanced-content { padding: 4px 0 24px; }

          .result-head { display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 600; }
          .check-badge { width: 32px; height: 32px; border-radius: 50%; background: #10B981; display: flex; align-items: center; justify-content: center; }
          .result-panel { background: var(--s1); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
          .link-box {
            font-family: var(--mono);
            font-size: 14px;
            line-height: 1.6;
            color: var(--tx);
            word-break: break-all;
            background: var(--bg);
            border: 1px solid var(--bd);
            border-radius: 8px;
            padding: 14px 16px;
          }
          .link-box:hover { color: var(--tx); border-color: #00D4AA; }
          .result-actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
          .result-note { font-size: 15px; line-height: 1.6; color: var(--tx2); }

          .aside { flex: 0 1 340px; min-width: 0; display: flex; flex-direction: column; gap: 20px; padding-top: 8px; }
          .aside-eyebrow { font-family: var(--mono); font-size: 13px; color: var(--act); margin-bottom: 16px; }
          .steps { list-style: none; display: flex; flex-direction: column; gap: 18px; }
          .steps li { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 12px; }
          .step-num { width: 28px; height: 28px; border-radius: 50%; background: var(--ac); color: #1A1F36; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
          .step-body { display: flex; flex-direction: column; gap: 4px; }
          .step-title { font-size: 15px; font-weight: 600; }
          .step-text { font-size: 14px; line-height: 1.55; color: var(--tx2); }
          .cli-card { border: 1px solid var(--bd); border-radius: 12px; padding: 24px; display: flex; flex-direction: column; gap: 14px; }
          .cli-links { display: flex; gap: 6px 18px; flex-wrap: wrap; font-size: 14px; font-weight: 500; }
          .stats-count { font-size: 14px; color: var(--tx3); }

          .reveal-wrap { max-width: 640px; margin: 0 auto; padding: clamp(40px, 8vw, 88px) 24px 96px; }
          .reveal-wrap .eyebrow { font-size: 13px; margin-bottom: 24px; }
          .note-head { display: flex; align-items: center; gap: 16px; }
          .note-head-text { display: flex; flex-direction: column; gap: 2px; }
          .note-from { font-size: 14px; color: var(--tx2); }
          .note-title { font-size: clamp(24px, 4vw, 32px); font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; overflow-wrap: anywhere; }
          .reveal-wrap .chip { color: var(--tx); padding: 5px 12px; }
          .reveal-panel { display: flex; flex-direction: column; gap: 18px; }
          .reveal-intro { font-size: 16px; line-height: 1.6; }
          .attempts-label { font-size: 13px; color: var(--tx2); }
          .secret-box {
            background: #1A1F36;
            color: #E8EBF0;
            border-radius: 12px;
            padding: 22px 24px;
            font-family: var(--mono);
            font-size: 15px;
            line-height: 1.65;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .burned-notice { background: var(--s1); border-radius: 12px; padding: 18px 22px; display: flex; gap: 14px; align-items: flex-start; }
          .burned-notice svg { flex: none; margin-top: 2px; }
          .burned-head { font-size: 15px; font-weight: 600; }
          .burned-text { font-size: 15px; line-height: 1.55; color: var(--tx2); }
          .gone { display: flex; flex-direction: column; gap: 20px; align-items: flex-start; }
          .gone h1 { font-size: clamp(30px, 5vw, 44px); font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; }
          .gone p { font-size: 18px; line-height: 1.6; color: var(--tx2); max-width: 520px; }

          .fade-out { animation: fadeOut 300ms ease forwards; }
          .fade-in { animation: fadeIn 300ms ease forwards; }
          @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

          @media (prefers-reduced-motion: reduce) {
            .fade-out, .fade-in { animation: none; opacity: 1; }
          }
        ` }} />
      </head>
      <body>
        <header class="site-header">
          <div class="site-header-inner">
            <a href="/" class="brand">
              <span class="brand-logo">gremlin<span class="teal-dot">.</span></span>
              <span class="brand-divider"></span>
              <span class="brand-name">Secure Note</span>
            </a>
            <nav class="site-nav">
              <a href="/#how">How it works</a>
              <a href="/#cli">CLI</a>
              <a href="/api/docs">API docs</a>
              <button id="theme-toggle" class="theme-toggle" aria-label="Toggle light and dark theme">
                <svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
                <svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>
              </button>
            </nav>
          </div>
        </header>
        <main>
          {children}
        </main>
        <footer class="site-footer">
          <div class="site-footer-inner">
            <span class="powered">Powered by <a href="https://gremlin.group">gremlin<span class="teal-dot">.</span></a></span>
            <span class="footer-links">
              <a href="/api/docs">API</a>
              <a href="/cli.sh">CLI</a>
              <a href="https://support.gremlin.group">Support</a>
            </span>
          </div>
        </footer>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `document.getElementById("theme-toggle").addEventListener("click",function(){var c=document.documentElement.getAttribute("data-theme")||"dark";var n=c==="dark"?"light":"dark";document.documentElement.setAttribute("data-theme",n);localStorage.setItem("theme",n);});` }} />
      </body>
    </html>
    </>
  );
};
