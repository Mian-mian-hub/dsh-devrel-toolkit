# dsh-devrel-toolkit

A small DeepSeek Harness plugin that registers one tool, `analyze_feedback`. It uses
deterministic string matching — no LLM call, no external APIs — to turn raw developer
feedback into a category and an information checklist for maintainers.

## Load it locally

Install the plugin's dependencies once:

```sh
npm install
```

Then point a DSH profile at this project's `cordis.yml`, from the project root:

```sh
dsh web --patch ./cordis.yml
```

`cordis.yml` is a **patch overlay**, not a profile config — `dsh` only reads it because
`--patch` names it. It is a different file (and a different YAML dialect) from
`$DSH_HOME/profiles/<name>/cordis.yml`, which `dsh` rewrites to `[]` on every boot.

To check the row landed before booting:

```sh
dsh web --patch ./cordis.yml --dump-config
```

You should see `- id: dsh-devrel-toolkit` in the output. No build step is needed: Node
22.18+ strips the types from `src/index.ts` and the loader imports it directly.

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

## v0 scope

This is intentionally simple code for learning the DSH plugin architecture: one plugin,
one tool, two branches of string matching. It does not call an LLM or any external API.

A note on the matching rule: when a plugin really does forget `inject = ['tools']`,
Cordis does not hand back `undefined` — it throws `cannot get property "tools" without
inject`. That message contains neither `undefined` nor `not available`, so the tool also
matches on `without inject`, and a verbatim paste of the real error lands in the right
branch.
