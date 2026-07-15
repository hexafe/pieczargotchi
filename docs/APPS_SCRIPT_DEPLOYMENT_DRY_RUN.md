# Apps Script Deployment Dry Run

This checklist verifies the real Google Apps Script execution without committing deployment credentials or private IDs. The current polaroid release candidate is app `0.1.61` with state schema v22; verify the tracked constants again immediately before deployment.

## Local Preflight

Run from the repo root:

```sh
python3 -m pip install -r requirements-qa.txt
npm ci
npm run qa
npm run apps-script:status
```

Expected posture before binding:

- `.clasp.json` is absent or ignored by Git.
- `.claspignore` reports only root `.gs`, `.html`, and `appsscript.json`; it never reports `dist/`, scripts, docs, or browser `.js` bundles.
- `Config.gs` does not contain private Drive URLs or deployment credentials.
- `PIECZARGOTCHI_APP_VERSION` and `package.json` both equal `0.1.61`, while `PIECZARGOTCHI_STATE_VERSION` equals `22`.
- `SpriteLayout.gs` is present in the Apps Script file set and is current for every tight runtime atlas; it is generated, not edited by hand.
- Production execution flags keep `debugEnabled: false` and `exposeRuntime: false`.
- Production `assetMode` stays `critical` so the deployed app renders quickly instead of embedding the full PNG manifest in the initial Apps Script HTML response.
- The preferred Script Property for this release is `PIECZARGOTCHI_ASSET_BASE_URL_0_1_61=https://PUBLIC-HOST/releases/0.1.61/assets/`. Both the key and path are release-specific so a later property update cannot retarget this deployment. It must use HTTPS and may be public because it contains no credential. The host must retain old release directories.
- Missing public hosting and Drive IDs are acceptable only for the placeholder smoke; the full supported Apps Script smoke must load the critical PNGs from the public base URL.

## Test Project Bind

Use a throwaway Apps Script project, not production:

```sh
npx --no-install clasp login
npx --no-install clasp create-script --type webapp --title "Pieczargotchi Dry Run"
node scripts/check-deployment-readiness.mjs
npm run apps-script:status
npx --no-install clasp push
```

Without a local `.clasp.json`, clasp must stop before any remote write. This is the expected safe blocker before a test Apps Script project is bound.

Do not commit `.clasp.json`. Before any commit or push, verify:

```sh
git status --short --untracked-files=all
git ls-files .clasp.json
```

The first command may show local `.clasp.json`; the second command must print nothing.

## Web App Smoke

Deploy or open a test deployment from the Apps Script UI, then verify in the browser:

- The app loads without a blank screen.
- The first UI render appears before live weather or non-critical PNGs finish loading.
- The asset status settles to backup graphics, partial graphics, or loaded graphics.
- Network requests for PNGs use the configured HTTPS asset base and the visible app-version query.
- The debug panel is hidden.
- `window.__pieczargotchiRuntime` is `undefined` in the browser console.
- Basic care actions update the message/log and persist after refresh.
- A legendary-stage save can reveal the `Opieka / Arena` switch, and Arena opens without script errors.
- Care sprites use the tight-atlas layout without stretching to the whole canvas, and one shared grass field covers the base without growing out of the mushroom.
- Arena loads the shared background plus two body-only raster combatants. Starting successive trophy tiers shows `sproutling`, `windcap`, and `eldercap` identities instead of the loading silhouette or a recolored care-stage sprite.

Before calling the deployment release-ready, set `DEPLOYED_APPS_SCRIPT_URL` to its public `/exec` URL and run the automated external gate:

```sh
PIECZARGOTCHI_APPS_SCRIPT_WEB_APP_URL="$DEPLOYED_APPS_SCRIPT_URL" npm run qa:apps-script-release
```

The command fails closed when the deployed build is stale, debug/runtime exposure is enabled, the public asset root is missing or mutable, or any critical PNG is unavailable.

For the legendary smoke, use the browser console on the test web app:

```js
const state = JSON.parse(localStorage.getItem('pieczargotchi_state_v2'));
// Preserve a copy as a v21 migration fixture before the first v22 load.
localStorage.setItem('pieczargotchi_state_v21_dry_run_backup', JSON.stringify(state));
state.version = Math.min(Number(state.version) || 21, 21);
state.stats.growth = 100;
state.stage = 'legendary';
state.inventory.spores = Math.max(6, state.inventory.spores || 0);
localStorage.setItem('pieczargotchi_state_v2', JSON.stringify(state));
location.reload();
```

After reload, confirm that the save migrated to v22, ordinary care/progression fields survived, and a newly started battle persists `player.visualId` plus `opponent.visualId`. A legacy active battle without `opponent.visualId` must normalize from its opponent name rather than corrupting or discarding unrelated save state.

## Optional private Drive backup smoke

Drive is not enabled in the public manifest. A separate controlled deployment may enable the code-level backup path only after adding the minimum read-only OAuth scope and reviewing the consent/deployment posture. In that deployment, set `PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID` as a private Script Property and mirror manifest paths in the folder.

The browser can request only a whitelisted manifest key. `getAssetDataUrls_`, `fileToDataUrl_`, and folder-ID helpers remain private Apps Script functions. Never paste private folder/file IDs into tracked files or expose them in client config.

## Closeout

After the dry run:

- Remove or leave untracked local-only `.clasp.json`.
- Remove any temporary private Drive folder or file IDs from tracked files if you used an unsafe local edit.
- Record the result in the PR body or project checkpoint.
- Record desktop and 390x844 mobile captures for care mode and Arena; Node contracts alone are not sufficient visual deployment evidence.
- Commit only documentation, checker, or code changes that do not contain private deployment data.
