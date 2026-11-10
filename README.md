# Revisely

Revision-proofing + version tracking for commission artists. Built as a Cloudflare
Pages app (static `public/` + Pages Functions) with a D1 (SQLite) database. Artists
create a commission, upload sketch versions, and send clients a read-only link to
approve or request changes — with full version history and deposit/delivery tracking.

This README only covers **local development** and the **GitHub → Cloudflare auto-deploy
setup**. Product details live in the code.

---

## 1. Local development

```bash
npm install
npm run dev          # wrangler pages dev (serves /, /app, /client)
```

Pages:
- Landing:  `http://localhost:8788/`
- Artist:   `http://localhost:8788/app`
- Client:   `http://localhost:8788/client?token=<token>`

The D1 schema is created automatically on first request (no migration step). Local
data lives in a throwaway sqlite file managed by wrangler.

---

## 2. Deploy (GitHub → Cloudflare, automatic)

This follows the same method used by the SlideVault project:
**push to `main` → GitHub Actions (wrangler-action) → Cloudflare Pages**,
with the Cloudflare token kept as a GitHub Secret. No manual deploy command needed.

### One-time setup (your machine — where you're logged into GitHub)

**a) Create the repo on GitHub, then push with plain git**
Your other projects already use the macOS keychain credential helper for
passwordless pushes, so **no `gh` CLI is needed** — this matches the SlideVault
setup exactly.

1. In your browser (already logged into GitHub): create a **new private repo**
   named `revisely` (leave it empty — no README / .gitignore).
2. Point the local repo at it and push:
```bash
cd /Users/huangzhuohui/WorkBuddy/2026-11-09-10-17-54/revisely
git remote add origin https://github.com/<your-username>/revisely.git
git push -u origin main
```
If the repo already exists, just use its URL in the `git remote add` line.

**b) Add two GitHub Secrets** (repo → Settings → Secrets and variables → Actions):
- `CLOUDFLARE_API_TOKEN` — a Cloudflare API token with **Pages:Edit** and **D1:Edit**
  permissions (create one at Cloudflare → My Profile → API Tokens → Create Custom Token).
- `CLOUDFLARE_ACCOUNT_ID` — your account ID (Cloudflare dashboard right sidebar).

**c) Create the D1 database and bind it** (one manual Cloudflare step):
1. Cloudflare dashboard → **Workers & Pages → D1** → Create database named `revisely`.
2. Open the `revisely` **Pages** project → **Settings → Functions → D1 database bindings**
   → Add binding **`DB`** → select the `revisely` database.

> The code already reads the binding as `env.DB`, so no code change is needed.
> The GitHub Actions workflow creates the Pages project on first deploy if it doesn't exist.

### After setup
Every `git push origin main` triggers the workflow and deploys in ~2–3 minutes.
The D1 schema self-initializes on first request, so there is no manual SQL step.

---

## 3. Alternative: zero-CI deploy (Cloudflare "Connect to Git")

If you prefer not to use GitHub Actions, you can skip the Secrets entirely:
Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** →
select the `revisely` repo, set **Framework preset: None**, **Build command: (empty)**,
**Output directory: `public`**. Then do step 2c (D1 binding) above. Push to `main` and
Cloudflare builds and deploys automatically.

---

## 4. Manual deploy (backup)

```bash
npm run deploy      # wrangler pages deploy public --project-name revisely
```
Requires `wrangler login` (or `CLOUDFLARE_API_TOKEN` in the environment) and the D1
binding configured in the dashboard.
