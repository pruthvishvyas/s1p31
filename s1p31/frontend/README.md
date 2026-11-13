# s1p31

A web dashboard for the analysis in the backend folder: key numbers, charts, insights, what-if scenarios, a forecast, a Predict page and alerts.

## Run it locally

You need Node 22 or newer.

    npm install
    npm run check
    npm run dev

Open http://localhost:5173. Every feature works locally with no account or login. `npm run check` validates every data file against the shapes the pages expect and fails with a clear message instead of showing blank panels. `npm run dev:worker` runs the production runtime and the security headers locally at http://localhost:8787.

Local settings go in `.dev.vars` (see `.dev.vars.example`). To try the MCP route, set `MCP_MODE=open` there and run:

    curl -X POST http://localhost:5173/mcp -H "content-type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

Remote assistants cannot reach localhost, so connecting one needs the published address.

## Update after the backend is re-run

Run `npm run deploy` in this folder. It refreshes the data, checks it, builds and publishes.

## Publish

    npx wrangler login
    npm run deploy

Wrangler prints the live address.

## Protecting the site

The data files are public to anyone who can open the site. For real client data, put the address behind a Cloudflare Access policy. Synthetic portfolio data can stay open.

## Optional MCP access

The site can expose read-only analytics over MCP. `MCP_MODE` in `wrangler.toml` has three values: `off` (default), `token` (clients send a bearer token; set it with `npx wrangler secret put MCP_TOKEN`) and `open` (no token, suitable for synthetic data only).

## Where the data comes from

`public/data` is a copy of `../backend/output`, refreshed by `scripts/refresh-data.mjs` before every dev, check and build run. `scripts/check-data.mjs` runs every file through the same readers the pages use.

## Folder map

- `src/` pages, components, readers for each data file, formatting helpers
- `worker/index.js` the small server for `/api/forecast` and `/mcp`
- `public/` static files and the data copy
- `scripts/` data refresh and data check
