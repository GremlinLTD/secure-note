import type { FC, PropsWithChildren } from "hono/jsx";
import { raw } from "hono/html";

type LayoutProps = PropsWithChildren<{
  title: string;
  nonce: string;
}>;

const svgLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 60" fill="none">
  <text x="0" y="46" font-family="Inter, Helvetica Neue, Helvetica, Arial, sans-serif" font-size="52" font-weight="700" letter-spacing="-0.02em">
    <tspan fill="#FFFFFF">gremlin</tspan><tspan fill="#00D4AA">.</tspan>
  </text>
</svg>`;

export const Layout: FC<LayoutProps> = ({ title, nonce, children }) => {
  return (
    <>
    {raw('<!DOCTYPE html>')}
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <style nonce={nonce}>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          :root {
            --bg: #0F1219;
            --surface: #1A1F36;
            --surface-raised: #1E2440;
            --border: #2A3142;
            --border-hover: #3D4663;
            --teal: #00D4AA;
            --teal-dim: rgba(0, 212, 170, 0.1);
            --coral: #FF6B6B;
            --text: #E8EBF0;
            --text-muted: #A8B2C7;
            --radius: 10px;
            --radius-lg: 14px;
            --shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
            color-scheme: dark;
          }

          body {
            background: var(--bg);
            color: var(--text);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 48px 16px 24px;
          }

          .container {
            max-width: 520px;
            width: 100%;
            flex: 1;
          }

          .logo {
            text-align: center;
            margin-bottom: 36px;
          }

          .logo svg {
            height: 36px;
            width: auto;
          }

          .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 32px;
            box-shadow: var(--shadow);
          }

          h1 {
            font-size: 24px;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 6px;
          }

          p.subtitle {
            color: var(--text-muted);
            font-size: 14px;
            line-height: 1.5;
            margin-bottom: 28px;
          }

          label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: var(--text-muted);
            margin-bottom: 6px;
          }

          input,
          textarea,
          select {
            display: block;
            width: 100%;
            max-width: 100%;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            background: var(--surface-raised);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            color: var(--text);
            font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;
            font-size: 14px;
            padding: 12px 14px;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
          }

          input::placeholder,
          textarea::placeholder {
            color: #556178;
          }

          input:focus,
          textarea:focus,
          select:focus {
            border-color: var(--teal);
            box-shadow: 0 0 0 3px var(--teal-dim);
          }

          textarea {
            resize: vertical;
            min-height: 160px;
            line-height: 1.5;
          }

          select {
            cursor: pointer;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23A8B2C7' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
            padding-right: 36px;
          }

          .form-group {
            margin-bottom: 20px;
          }

          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }

          @media (max-width: 480px) {
            .form-row {
              grid-template-columns: 1fr;
            }
          }

          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            border: none;
            border-radius: var(--radius);
            cursor: pointer;
            font-family: inherit;
            font-size: 15px;
            font-weight: 600;
            padding: 12px 24px;
            transition: transform 0.1s, opacity 0.15s;
          }

          .btn:hover { opacity: 0.9; }
          .btn:active { transform: scale(0.98); }
          .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

          .btn-primary {
            background: var(--teal);
            color: #0D1117;
          }

          .btn-secondary {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-muted);
          }

          .btn-secondary:hover {
            border-color: var(--border-hover);
            color: var(--text);
          }

          .btn-danger {
            background: var(--coral);
            color: #fff;
          }

          .row {
            display: flex;
            gap: 10px;
            align-items: stretch;
          }

          .link-box {
            display: block;
            background: var(--surface-raised);
            border: 1px solid var(--teal);
            border-radius: var(--radius);
            color: var(--teal);
            font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
            font-size: 13px;
            padding: 12px 14px;
            word-break: break-all;
            line-height: 1.5;
            text-decoration: none;
            flex: 1;
          }

          .link-box:hover {
            background: var(--teal-dim);
          }

          .secret-box {
            background: var(--surface-raised);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            color: var(--text);
            font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
            font-size: 14px;
            padding: 16px;
            white-space: pre-wrap;
            word-break: break-word;
            line-height: 1.6;
            margin-top: 16px;
          }

          .warning {
            color: var(--coral);
            font-size: 13px;
            margin-top: 12px;
          }

          .success {
            color: var(--teal);
            font-size: 14px;
            font-weight: 500;
            margin-top: 12px;
          }

          .burned-msg {
            text-align: center;
            padding: 32px 0;
          }

          .burned-msg h2 {
            color: var(--coral);
            font-size: 20px;
            margin-bottom: 8px;
          }

          .burned-msg p {
            color: var(--text-muted);
          }

          .hidden { display: none; }

          .mt-md { margin-top: 16px; }

          .size-counter {
            font-weight: 400;
            font-size: 12px;
            color: var(--text-muted);
          }

          .size-over {
            color: var(--coral);
          }

          .note-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--text);
            margin-bottom: 8px;
          }

          .teal-dot { color: var(--teal); }

          .footer {
            color: #556178;
            font-size: 12px;
            margin-top: 40px;
            text-align: center;
          }

          .footer a {
            color: var(--teal);
            text-decoration: none;
          }
        `}</style>
      </head>
      <body>
        <div class="container">
          <div class="logo" dangerouslySetInnerHTML={{ __html: svgLogo }} />
          {children}
        </div>
        <footer class="footer">Powered by <a href="https://gremlin.group">gremlin<span class="teal-dot">.</span></a></footer>
      </body>
    </html>
    </>
  );
};
