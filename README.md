# dsh-devrel-toolkit

[![CI](https://github.com/Mian-mian-hub/dsh-devrel-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/Mian-mian-hub/dsh-devrel-toolkit/actions/workflows/ci.yml)

A DeepSeek Harness plugin with a **native sidebar dashboard** for GitHub Issue triage.
New Issues enter a persistent local queue, receive one bounded model classification,
and appear as readable cards in **DevRel 看板**. It creates no chat Sessions and
registers no conversation tools by default.

The board includes status counts, search, status filtering, Issue details, and
manual retry for failed analyses. Each result separates tentative classification,
missing information, the next action, and a product signal. First-pass analysis
uses only the supplied Issue: solutions are explicitly marked **not searched**.

## Run the dashboard from source

```sh
npm ci
npm run setup:issues -- Mian-mian-hub/dsh-devrel-toolkit
npm run start:issues
```

Open DSH's printed URL and click **DevRel 看板** in the left sidebar. Configure a
working provider/model in Settings → Models, then in another terminal:

```sh
npm run demo:issue
```

A card labeled **本地演示** appears and updates automatically. This consumes one
model request, creates no real GitHub Issue, and creates no conversation Session.
The generated `.env.local` contains the repository allowlist and secret; it is
ignored by Git. The board uses DSH's existing model credentials.

For real events, expose the dedicated port 3081 through HTTPS and configure the
monitored repository's webhook. See [the deployment guide](docs/github-issues.md).
Pushing code to GitHub alone does not start a receiver.

## Install directly from GitHub (recommended)

This release targets **DSH 0.1.7-rc.2**. Use Node.js **24 LTS**, Git, and pnpm
10.32.1 or newer. If DSH and pnpm are not already installed:

```sh
npm install --global @deepseek-ai/dsh@0.1.7-rc.2 pnpm@10.32.1
```

Install the bundle into your Web profile:

```sh
dsh plugin --profile web add github:Mian-mian-hub/dsh-devrel-toolkit
```

GitHub installation fetches source and runs this repository's self-contained
`prepare` script to build `dist/index.js`. With pnpm 10+, the first attempt can
report `GIT_DEP_PREPARE_NOT_ALLOWED`. Allow this package's build in
`$DSH_HOME/profiles/web/pnpm-workspace.yaml` (default:
`~/.dsh/profiles/web/pnpm-workspace.yaml`), keeping the file's existing settings:

```yaml
allowBuilds:
  dsh-devrel-toolkit: true
```

If an `allowBuilds` mapping already exists, add this entry to it instead of
creating a second mapping. If pnpm prints a more specific package key, use the
exact key it names. Then retry the same installation command:

```sh
dsh plugin --profile web add github:Mian-mian-hub/dsh-devrel-toolkit
dsh web
```

DSH installs the package and adds it to the profile's `dsh.profile.bundles` list.
Later starts load it automatically; **no `--patch` argument is needed**. Open the
URL printed by DSH and select **DevRel 看板** in the sidebar. Configure a
model/provider in Settings to analyze incoming Issues. The bundle loads the board;
receiving webhooks also requires the opt-in listener described above.

For reproducible installs, pin the reviewed commit:

```sh
dsh plugin --profile web add github:Mian-mian-hub/dsh-devrel-toolkit#<commit-sha>
```

The build allowance authorizes this package's install-time code. The repository
has not been published to npm; a bare `add dsh-devrel-toolkit` registry install
is not available.

## Build an installable package locally

The checkout installs a matching DSH CLI and pnpm locally:

```sh
git clone https://github.com/Mian-mian-hub/dsh-devrel-toolkit.git
cd dsh-devrel-toolkit
npm ci
npm run check
npm pack
npm exec -- dsh plugin --profile web add ./dsh-devrel-toolkit-0.0.1.tgz
npm start
```

`npm ci` builds through `prepare`; `npm pack` rebuilds and includes the JavaScript
entry and bundle patch. The prebuilt tarball avoids install-time compilation.
`npm start` uses the checkout's matching DSH CLI; add `-- --no-open` to leave the
browser closed.

### Install a built package in an existing DSH profile

With DSH 0.1.7-rc.2 and pnpm available on PATH:

```sh
dsh plugin --profile web add /absolute/path/to/dsh-devrel-toolkit-0.0.1.tgz
dsh web
```

You can also give this tarball's absolute path to the DSH Web **Plugins** page's
bundle installer. The built tarball does not require install-time compilation.
After installation, its enablement is managed by DSH, independently of the source
checkout. Stop using the development `--patch` overlay when the bundle is enabled,
so the plugin is loaded only once.

To remove it using the checkout's CLI:

```sh
npm exec -- dsh plugin --profile web remove dsh-devrel-toolkit
```

Restart DSH after package changes if your profile does not apply them live.
Installation changes the named profile; it does not change other profiles.

## Bundle and profile manifests

The installable package declares the bundle in **package.json**:

```json
{
  "main": "./dist/index.js",
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

**cordis.patch.yml** inserts the compiled board service and its UI plugin
(repository configuration is omitted here):

```yaml
- insert:
    - id: dsh-devrel-toolkit
      name: './dist/index.js'
    - id: devrel-board-ui
      name: './ui/index.js'
```

DSH records the enabled bundle in the **profile's** package.json, alongside its
existing bundles. For the Web profile, the resulting selection looks like:

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-devrel-toolkit"
      ]
    }
  }
}
```

These are separate manifests: this plugin extends an existing profile rather than
providing a standalone application profile. The installer manages the profile's
dependency and selection; users do not need to edit that JSON by hand.
The package's `engines.dsh` and peer dependencies declare the compatible runtime.
Cordis, the LLM service and Typert RPC are supplied by DSH. The nested
`ui/package.json` declares `dsh.client` and exports `./client`; DSH discovers it
from the UI plugin entry and serves the browser module through its native client
module loader. UI calls use DSH's authenticated RPC gateway.

## Develop and verify

```sh
npm ci
npm test
npm run check
npm run test:bundle
```

`npm run check` imports the compiled board, checks Cordis activation and Remote
method registration, and reads its empty storage with no credentials or model call.

`npm test` covers output validation, filtering, signed webhook admission, deduplication,
persistence, restart recovery and failed-analysis retry. The official GitHub adapter
is exercised without providing Agent or Session services. The legacy tool has its
own isolated tests.

`npm run test:bundle` packs the distribution, installs it through the DSH CLI into a
temporary profile, boots the board, checks the shipped UI and bridge, and removes
the bundle. The packed install uses offline mode with scripts blocked. CI also
tests a pinned GitHub source installation on pushes to main. CI runs on Node 22.18,
current Node 22, and Node 24. Your normal profiles remain untouched.

For source editing without installing a bundle:

```sh
npm run dev
```

This explicitly loads **cordis.yml**, the source-only development overlay pointing
to `src/index.ts`. It is separate from the installable **cordis.patch.yml**.
Do not enable the installed bundle and this source overlay in the same profile.
Node 22.18+ can run the source directly; code installed under `node_modules` uses
the built JavaScript entry. After source changes, rebuild and reinstall the package
to update an installed bundle.

## Installation troubleshooting

| Symptom | What to check |
| --- | --- |
| `dsh` or `pnpm` is not found | Run `npm ci`, then use `npm exec -- dsh ...` from this checkout. |
| TypeScript errors while loading an installed package | Rebuild with `npm pack` and install the new tarball; the bundle must point to `dist/index.js`. |
| Plugin absent after installation | Run `npm run check:config`; look for `id: dsh-devrel-toolkit` and the installed `dist/index.js`. Check the selected profile and its bundle enablement. |
| Runtime version rejected | Use DSH 0.1.7-rc.2. Newer versions have not been verified for this release. |
| npm download, proxy, or certificate errors | Check `npm config get registry` and your network/proxy settings. |
| Git installation reports a blocked build | Approve the exact prepare/build package named by DSH/pnpm, or install the prebuilt tarball. |
| Duplicate plugin entry | Remove the development `--patch ./cordis.yml` when using the installed bundle. |
| Web server cannot bind its port | Stop the other server or inspect `npm start -- --help` for Web options. |
| Offline check passes but chat cannot answer | Check model/provider authentication in DSH. |

## Legacy keyword tool (explicit opt-in)

The original deterministic `analyze_feedback` implementation remains available at
`dsh-devrel-toolkit/analyze-feedback`. It is not loaded by the default bundle or
used by the dashboard. Only install that separate entry if you deliberately want
a conversation tool.

## Current limits

The board shows the latest 100 records; older records stay in its local JSON store.
It handles new Issues only, with no historical backfill, comment/PR ingestion,
repository search or automatic GitHub replies. The signed adapter acknowledges
before disk persistence, so a process crash at that boundary can lose an event.
See the deployment guide for queue behavior and operational details.
