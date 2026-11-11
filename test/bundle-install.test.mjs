import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const anchor = require.resolve('@deepseek-ai/dsh/package.json')
const hostRequire = createRequire(anchor)
const cli = join(dirname(anchor), 'lib/bin.js')
const host = await import(pathToFileURL(hostRequire.resolve('@deepseek-ai/dsh-app-boot')).href)
const gitSpec = process.env.DSH_BUNDLE_GIT_SPEC

test(`${gitSpec ? 'Git source' : 'packed'} bundle installs, activates and uninstalls through the DSH CLI`, { timeout: 300000 }, async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), 'devrel-bundle-'))
  t.after(() => rm(scratch, { recursive: true, force: true }))
  const home = join(scratch, 'home')
  const profileDir = join(home, 'profiles', 'bundle-test')
  host.initProfile(profileDir, [])
  const env = {
    ...process.env,
    DSH_HOME: home,
    DSH_TELEMETRY_DISABLED: '1',
    PATH: join(root, 'node_modules', '.bin') + delimiter + process.env.PATH,
  }
  const runDsh = async (...args) => {
    try {
      const { stdout } = await exec(process.execPath, [cli, ...args], {
        cwd: scratch, env, timeout: gitSpec ? 180000 : 60000, maxBuffer: 2 * 1024 * 1024,
      })
      return stdout
    } catch (error) {
      throw new Error(`${error.message}\n${error.stdout ?? ''}\n${error.stderr ?? ''}`)
    }
  }

  if (gitSpec) {
    // Only the test's temporary profile authorizes this known repository's build.
    await writeFile(join(profileDir, 'pnpm-workspace.yaml'), [
      'packages:', '  - .', 'nodeLinker: hoisted', 'autoInstallPeers: false',
      'allowBuilds:', '  dsh-devrel-toolkit: true', '',
    ].join('\n'))
    await runDsh('plugin', '--profile', 'bundle-test', 'add', gitSpec)
  } else {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const { stdout } = await exec(npm, ['pack', '--silent', '--json', '--pack-destination', scratch], {
      cwd: root, env, timeout: 30000,
    })
    const [packed] = JSON.parse(stdout)
    const paths = packed.files.map((file) => file.path)
    assert.ok(paths.includes('dist/index.js'))
    assert.ok(paths.includes('dist/github-issues.js'))
    assert.ok(paths.includes('examples/github-issues/cordis.yml'))
    assert.ok(paths.includes('cordis.patch.yml'))
    assert.ok(!paths.some((path) => path.startsWith('src/')))
    // Prebuilt packages must install with scripts blocked and registry access disabled.
    await runDsh('plugin', '--profile', 'bundle-test', 'add', join(scratch, packed.filename),
      '--offline', '--ignore-scripts')
  }
  const manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'))
  assert.ok(manifest.dependencies['dsh-devrel-toolkit'])
  assert.deepEqual(manifest.dsh.profile.bundles, ['dsh-devrel-toolkit'])
  const installed = join(profileDir, 'node_modules', 'dsh-devrel-toolkit')
  const installedManifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'))
  assert.equal(installedManifest.dsh.bundle.patch, './cordis.patch.yml')

  const dump = await runDsh('bundle-test', '--dump-config')
  assert.match(dump, /id: dsh-devrel-toolkit/)
  assert.match(dump, /dist\/index\.js/)
  assert.doesNotMatch(dump, /src\/index\.ts/)

  const profile = host.loadProfileDirectory('test', profileDir, anchor)
  assert.deepEqual(profile.skippedBundles, [])
  const resolution = await host.createRuntimeResolution({ installAnchor: anchor, profile, home })
  const config = join(profileDir, 'cordis.yml')
  // Supply only the services the tool needs. The plugin row itself comes
  // exclusively from the installed bundle's manifest and patch.
  await writeFile(config, [
    '- id: system-prompt', '  name: "@deepseek-ai/dsh-system-prompt"',
    '- id: tools', '  name: "@deepseek-ai/dsh-tools"', '',
  ].join('\n'))
  const ctx = await host.boot('test', config, profile.layers.flatMap((layer) => layer.patches), async (ctx) => {
    await ctx.plugin(host.PluginPackages, { resolution })
  }, pathToFileURL(anchor).href)
  try {
    const entry = [...ctx.loader.entries()].find((entry) => entry.options.id === 'dsh-devrel-toolkit')
    assert.ok(entry, 'Installed bundle did not create a loader entry.')
    assert.equal(entry.fiber.state, 2)
    const tool = ctx.tools.get('analyze_feedback')
    assert.ok(tool)
    const args = { feedback: 'ctx.tools is undefined' }
    const result = await tool.execute(args)
    assert.match(result, /^Category: Plugin dependency/)
    assert.deepEqual(tool.output.render(args, result), [{ type: 'text', text: result }])
    let registeredRule
    ctx.provide('webhookRuntime', { register(value) { registeredRule = value; return () => {} } })
    const { default: path } = await import('node:path')
    await ctx.loader.root.create({
      id: 'installed-issue-rule',
      name: pathToFileURL(path.join(installed, 'dist/github-issues.js')).href,
      config: { source: 'test', repositories: ['example/repo'], workspacePath: scratch, agentPreset: 'standard', maxBodyChars: 12000 },
    })
    await ctx.loader.await()
    assert.ok(registeredRule, 'Compiled webhook entry must register through the real loader.')
    assert.equal(registeredRule.kind, 'github')
    const overlay = await readFile(join(installed, 'examples/github-issues/cordis.yml'), 'utf8')
    assert.match(overlay, /dist\/github-issues\.js/)
  } finally {
    await ctx.fiber.dispose()
  }

  await runDsh('plugin', '--profile', 'bundle-test', 'remove', 'dsh-devrel-toolkit')
  const removed = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'))
  assert.ok(!removed.dependencies?.['dsh-devrel-toolkit'])
  assert.deepEqual(removed.dsh.profile.bundles, [])
  assert.doesNotMatch(await runDsh('bundle-test', '--dump-config'), /id: dsh-devrel-toolkit/)
})
