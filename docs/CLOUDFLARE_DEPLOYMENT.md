# Cloudflare deployment

Pieczargotchi started as a Google Apps Script web app. Cloudflare cannot serve
Apps Script partials or `?bundle=...` endpoints directly, so the repository
builds a static Cloudflare bundle into `dist/`.

## Local build

From the repository root:

```sh
npm ci
npm run build:verified
```

The build writes:

- `dist/index.html`
- `dist/config.js`
- `dist/core.js`
- `dist/client.js`
- `dist/assets/...`

`dist/` is generated output and stays out of Git.

## Cloudflare Workers Builds

The failed log with `Executing user deploy command: npx wrangler deploy` means
Cloudflare used Workers Builds and tried to deploy the repository without a
static output directory. Use these settings:

- Root directory: repository root
- Build command: `npm ci && npm run build:verified`
- Deploy command: `npx --no-install wrangler deploy`
- Non-production branch deploy command: `npx --no-install wrangler versions upload`

The Worker name in Cloudflare must match `name` in `wrangler.jsonc`. The repo
uses `pieczargotchi`; if the Cloudflare Worker has another name, rename the
Worker or update `wrangler.jsonc`.

Workers Builds already run the deterministic verified-build gate above. For a
manual release from a workstation with Chrome and Pillow installed, use
`npm run deploy`; that wrapper rejects debug flags, runs the full `npm run qa`,
and only then invokes the pinned Wrangler JavaScript entry through Node.

## Cloudflare Pages alternative

If using Pages instead of Workers:

- Framework preset: None
- Build command: `npm ci && npm run build:verified`
- Build output directory: `dist`

Pages will create branch and pull-request preview URLs from the built static
files.

## Notes

- No private Drive IDs or Google deployment credentials are needed.
- The Cloudflare build copies only files referenced by the application manifest.
  Source, reference, and unmanifested compatibility files never enter `dist/`.
- Browser saves still use `localStorage` under `pieczargotchi_state_v2`.

For local screenshot QA only, build a separate debug directory:

```sh
npm run build:debug
```

This writes `dist-debug/`, never `dist/`. The production deploy wrapper rejects
debug/expose flags, alternate output directories, and full-asset mode before QA,
then rebuilds `dist/` with an explicit production marker.
