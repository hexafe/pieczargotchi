# Cloudflare deployment

Pieczargotchi started as a Google Apps Script web app. Cloudflare cannot serve
Apps Script partials or `?bundle=...` endpoints directly, so the repository
builds a static Cloudflare bundle into `dist/`.

## Local build

From the repository root:

```sh
npm run build
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
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Non-production branch deploy command: `npx wrangler versions upload`

The Worker name in Cloudflare must match `name` in `wrangler.jsonc`. The repo
uses `pieczargotchi`; if the Cloudflare Worker has another name, rename the
Worker or update `wrangler.jsonc`.

## Cloudflare Pages alternative

If using Pages instead of Workers:

- Framework preset: None
- Build command: `npm run build`
- Build output directory: `dist`

Pages will create branch and pull-request preview URLs from the built static
files.

## Notes

- No private Drive IDs or Google deployment credentials are needed.
- The Cloudflare build uses the committed PNG files under `assets/` and skips
  `assets/source/` plus `assets/reference/`.
- Browser saves still use `localStorage` under `pieczargotchi_state_v2`.

For local screenshot QA only, the build can expose the browser czas działania:

```sh
PIECZARGOTCHI_CLOUDFLARE_EXPOSE_RUNTIME=1 npm run build
```

Do not use that flag for the public friend-testing build unless you deliberately
want the debug czas działania visible in the browser console.
