# Tex Eval Dashboard

Hosted dashboard for Weber Ranch Tex's dynamic eval results — replaces the
Google Sheets log. Results are pushed automatically from the
`dynamic_eval.yml` GitHub Actions workflow after each run.

## Setup

1. **Deploy to Vercel**
   - Push this folder to its own GitHub repo (or a subfolder of an existing
     one, pointing Vercel's project root at this folder).
   - Import it into Vercel (vercel.com → Add New Project).

2. **Add a Postgres database**
   - In the Vercel project → Storage tab → Create Database → Postgres
     (or connect a Neon database).
   - Vercel automatically injects `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`
     into the project's environment variables — no manual copy-paste needed.

3. **Set the ingest secret**
   - In Vercel project settings → Environment Variables, add
     `INGEST_API_KEY` — any random string, e.g. generate one with
     `openssl rand -hex 32`.
   - Add the same value as a GitHub Actions secret in the
     `alabai-tex-runner` repo: Settings → Secrets and variables → Actions →
     New repository secret → name it `EVAL_DASHBOARD_KEY`.
   - Also add a repo secret `EVAL_DASHBOARD_URL` set to your deployed
     dashboard's URL (e.g. `https://tex-eval-dashboard.vercel.app`).

4. **Wire up the workflow**
   - Add a step to `.github/workflows/dynamic_eval.yml` (after the eval
     run step) that POSTs `tex_dynamic_results.json` to
     `${EVAL_DASHBOARD_URL}/api/eval-results` with header
     `Authorization: Bearer ${EVAL_DASHBOARD_KEY}`.

5. **View results**
   - Visit the deployed URL — table of runs, filterable by environment,
     category, and status.

## Local development

```bash
npm install
vercel env pull .env.local   # pulls POSTGRES_URL etc. from your Vercel project
npm run dev
```
