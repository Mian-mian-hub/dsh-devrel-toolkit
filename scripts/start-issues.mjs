import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
let installed = false
try { installed = JSON.parse(readFileSync(join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'profiles/web/package.json'))).dsh.profile.bundles.includes('dsh-devrel-toolkit') } catch {}
const args = [join(root, 'node_modules/@deepseek-ai/dsh/lib/bin.js'), 'web',
  ...(installed ? [] : ['--patch', join(root, 'cordis.patch.yml')]),
  '--patch', join(root, 'examples/github-issues/cordis.yml'), ...process.argv.slice(2)]
const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env })
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal))
child.on('error', (e) => { console.error(e.message); process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 0 })
