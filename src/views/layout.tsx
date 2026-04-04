import type { FC, PropsWithChildren } from "hono/jsx";

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
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <style nonce={nonce}>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          :root {
            --bg: #1A1F36;
            --surface: #141829;
            --border: #2A3142;
            --teal: #00D4AA;
            --coral: #FF6B6B;
            --text: #E2E8F0;
            --text-muted: #8892A4;
            --radius: 8px;
          }

          body {
            background: var(--bg);
            color: var(--text);
            font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 40px 16px 24px;
          }

          .container {
            max-width: 560px;
            width: 100%;
            flex: 1;
          }

          .logo {
            text-align: center;
            margin-bottom: 32px;
          }

          .logo svg {
            height: 32px;
            width: auto;
          }

          .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 32px;
          }

          h1 {
            font-size: 22px;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 8px;
          }

          p.subtitle {
            color: var(--text-muted);
            font-size: 14px;
            margin-bottom: 24px;
          }

          label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 6px;
          }

          input[type="text"],
          input[type="password"],
          textarea,
          select {
            width: 100%;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            color: var(--text);
            font-family: inherit;
            font-size: 15px;
            padding: 10px 12px;
            outline: none;
            transition: border-color 0.15s;
          }

          input[type="text"]:focus,
          input[type="password"]:focus,
          textarea:focus,
          select:focus {
            border-color: var(--teal);
          }

          textarea {
            resize: vertical;
            min-height: 140px;
          }

          select {
            cursor: pointer;
          }

          .form-group {
            margin-bottom: 20px;
          }

          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: var(--radius);
            cursor: pointer;
            font-family: inherit;
            font-size: 15px;
            font-weight: 600;
            padding: 10px 20px;
            transition: opacity 0.15s;
          }

          .btn:hover { opacity: 0.88; }
          .btn:active { opacity: 0.75; }

          .btn-primary {
            background: var(--teal);
            color: #0D1117;
          }

          .btn-danger {
            background: var(--coral);
            color: #fff;
          }

          .row {
            display: flex;
            gap: 8px;
          }

          .link-box {
            background: var(--bg);
            border: 1px solid var(--teal);
            border-radius: var(--radius);
            color: var(--teal);
            font-size: 13px;
            padding: 10px 12px;
            word-break: break-all;
            flex: 1;
          }

          .secret-box {
            background: var(--bg);
            border: 1px solid var(--teal);
            border-radius: var(--radius);
            color: var(--text);
            font-family: "Courier New", monospace;
            font-size: 14px;
            padding: 16px;
            white-space: pre-wrap;
            word-break: break-word;
            margin-top: 16px;
          }

          .warning {
            color: var(--coral);
            font-size: 13px;
            margin-top: 12px;
          }

          .success {
            color: var(--teal);
            font-size: 13px;
            margin-top: 12px;
          }

          .burned-msg {
            text-align: center;
            padding: 24px 0;
          }

          .burned-msg h2 {
            color: var(--coral);
            font-size: 20px;
            margin-bottom: 8px;
          }

          .hidden { display: none; }

          .footer {
            color: var(--text-muted);
            font-size: 12px;
            margin-top: 32px;
            text-align: center;
          }
        `}</style>
      </head>
      <body>
        <div class="container">
          <div class="logo" dangerouslySetInnerHTML={{ __html: svgLogo }} />
          {children}
        </div>
        <footer class="footer">Powered by gremlin.</footer>
      </body>
    </html>
  );
};
