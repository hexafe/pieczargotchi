# Apps Script Deployment Dry Run

This checklist verifies the real Google Apps Script runtime without committing deployment credentials or private IDs.

## Local Preflight

Run from the repo root:

```sh
node scripts/check-deployment-readiness.mjs
node scripts/check-client-syntax.mjs
node scripts/test-client-core.mjs
env TZ=UTC node scripts/test-client-core.mjs
node scripts/validate-assets.mjs
python3 scripts/audit-sprite-consistency.py
python3 scripts/audit-spore-sprites.py
bash scripts/run-local-linux.sh --check-only
```

Expected posture before binding:

- `.clasp.json` is absent or ignored by Git.
- `Config.gs` does not contain private Drive URLs or deployment credentials.
- Production runtime flags keep `debugEnabled: false` and `exposeRuntime: false`.
- Missing Drive IDs are acceptable for the first smoke because the app should render canvas fallbacks instead of a blank page.
- If runtime PNGs are hosted in Drive, prefer `PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID` over hundreds of manual IDs. Store the folder ID only, not a URL.
- The Drive folder should mirror manifest paths without the leading `assets/`, for example `stages/adult/idle_sheet.png`; flat folders only work for unique basenames.

## Test Project Bind

Use a throwaway Apps Script project, not production:

```sh
npx @google/clasp login
npx @google/clasp create --type webapp --title "Pieczargotchi Dry Run"
node scripts/check-deployment-readiness.mjs
npx @google/clasp push
```

Current local state on 2026-05-13: `env CI=1 npx --yes @google/clasp push` stops with `Project settings not found.` because this clone has no local `.clasp.json`. That is the expected safe blocker before a test Apps Script project is bound.

Do not commit `.clasp.json`. Before any commit or push, verify:

```sh
git status --short --untracked-files=all
git ls-files .clasp.json
```

The first command may show local `.clasp.json`; the second command must print nothing.

## Web App Smoke

Deploy or open a test deployment from the Apps Script UI, then verify in the browser:

- The app loads without a blank screen.
- The asset status settles to fallback graphics, partial graphics, or loaded graphics.
- The debug panel is hidden.
- `window.__pieczargotchiRuntime` is `undefined` in the browser console.
- Basic care actions update the message/log and persist after refresh.
- A legendary-stage save can reveal the `Opieka / Arena` switch, and Arena opens without script errors.

For the legendary smoke, use the browser console on the test web app:

```js
const state = JSON.parse(localStorage.getItem('pieczargotchi_state_v2'));
state.stats.growth = 100;
state.stage = 'legendary';
state.inventory.spores = Math.max(6, state.inventory.spores || 0);
localStorage.setItem('pieczargotchi_state_v2', JSON.stringify(state));
location.reload();
```

## Optional Drive Asset Smoke

For one controlled test, either temporarily set `PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID` to a test folder containing runtime PNGs, or set a test Drive PNG file ID for `environment.grassPatch` in `Config.gs`, then run:

```sh
node scripts/check-deployment-readiness.mjs
npx @google/clasp push
```

Then open the deployed app and confirm the asset status counts loaded graphics. Revert local private folder/file IDs before committing unless they are intentionally public and approved for the repository.

## Closeout

After the dry run:

- Remove or leave untracked local-only `.clasp.json`.
- Revert any temporary private Drive folder or file IDs.
- Record the result in the PR body or project checkpoint.
- Commit only documentation, checker, or code changes that do not contain private deployment data.
