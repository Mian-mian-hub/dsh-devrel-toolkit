# dsh-devrel-toolkit

[![CI](https://github.com/Mian-mian-hub/dsh-devrel-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/Mian-mian-hub/dsh-devrel-toolkit/actions/workflows/ci.yml)

A small DeepSeek Harness plugin that registers one tool, `analyze_feedback`. It uses
deterministic string matching — no LLM call, no external APIs — to turn raw developer
feedback into a category and an information checklist for maintainers.

## Automatic Issue triage (opt-in)

The new [GitHub Issue integration](docs/github-issues.md) accepts signed
`issues.opened` webhooks from configured repositories and creates read-only DSH
Agent Sessions with DevRel classification instructions. It reuses the official
GitHub adapter and webhook runtime; it is separate from the original keyword tool.

From this checkout, set `DEVREL_GITHUB_REPOSITORIES`, `DEVREL_WORKSPACE` and
`DSH_GITHUB_WEBHOOK_SECRET`, then run `npm ci` and `npm run start:issues`.
See the guide for model configuration, a signed local demo, the public endpoint,
and the TARGET repository's Webhook settings. This first milestone has no durable
queue or deduplication; results are in DSH Sessions. It is not deployed merely by
installing the package.

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
URL printed by DSH and configure a model/provider to use the chat interface.
The `analyze_feedback` tool itself needs no API key and makes no model calls.

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

**cordis.patch.yml** inserts the compiled plugin:

```yaml
- insert:
    - id: dsh-devrel-toolkit
      name: './dist/index.js'
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
Cordis and the tool runtime are supplied by DSH instead of bundled as private copies.

## Develop and verify

```sh
npm ci
npm test
npm run check
npm run test:bundle
```

`npm run check` runs offline after installation. It imports the source, activates
the plugin against the real Cordis/tool runtime, then executes and renders the tool.
Success starts with `OK:`. No model credentials are needed.

`npm run test:bundle` packs the actual distribution, installs it through the DSH
CLI into a temporary profile, checks its persisted selection and configuration,
boots the installed bundle with real tool services, executes the tool, and removes
it through the CLI. The packed plugin installs with scripts blocked and registry
access disabled; its runtime peers come from DSH. Your normal profiles are untouched. On pushes to main, CI also runs this test
against `github:Mian-mian-hub/dsh-devrel-toolkit#<tested-commit>`, allowing only
this package's prepare script in the temporary profile, to verify GitHub source
installation and execution.

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

## Example

Input (`feedback`):

```text
ctx.tools is undefined when my plugin loads.
```

Output:

```text
Category: Plugin dependency
Possible cause: The plugin may be using ctx.tools without declaring inject = ['tools'].
Information to collect:
- DSH version
- plugin source
- cordis.yml
- complete error message
Suggested next step: Verify that the plugin exports inject = ['tools'].
```

Any other feedback returns `Category: Unclassified developer feedback` with a checklist
for expected behavior, actual behavior, reproduction steps, DSH version, and relevant
configuration.

## Tests

```sh
npm test
```

Node's built-in test runner, no test framework to install. The suite covers the
classification rules (including the cases that should *not* match), the plugin's export
shape, and registration against a real `ToolRuntime` — asserting the fiber reaches
`ACTIVE`, since a plugin stuck at `PENDING` fails silently with no error at all.

CI is configured to run the unit and bundle-install suites on Node 22.18, current Node 22, and Node 24 for every push and pull request. Node 22.18+ is
required either way: the plugin and its tests are loaded as raw `.ts`, so they depend on
Node's unflagged type stripping.

## v0 scope

This is intentionally simple code for learning the DSH plugin architecture: one plugin,
one tool, two branches of string matching. It does not call an LLM or any external API.

A note on the matching rule: when a plugin really does forget `inject = ['tools']`,
Cordis does not hand back `undefined` — it throws `cannot get property "tools" without
inject`. That message contains neither `undefined` nor `not available`, so the tool also
matches on `without inject`, and a verbatim paste of the real error lands in the right
branch.
