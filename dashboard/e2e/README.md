# E2E tests

Run from **repo root** (recommended):

```bash
bun run build:dashboard   # once, so the server can serve the dashboard
bun run test:e2e
```

Or from the dashboard directory:

```bash
cd dashboard
bun run build             # if not already built
bun run test:e2e
```

**Requirements**

- Dashboard must be built (`dashboard/dist`) so the backend can serve it.
- From root, use `bun run test:e2e` so `.env` is loaded and the backend starts correctly.
- Port **3099** is used by default to avoid clashing with a dev server on 3000.

Install Playwright browsers once if needed: `cd dashboard && bunx playwright install chromium`
