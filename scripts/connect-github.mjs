import { spawn } from 'node:child_process'
const repository = process.env.DEVREL_GITHUB_REPOSITORIES
const secret = process.env.DSH_GITHUB_WEBHOOK_SECRET
const inputUrl = process.argv[2]
if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !secret) {
  throw new Error('Run npm run setup:issues -- owner/repository first. This command connects one repository.')
}
const url = new URL(inputUrl)
if (url.protocol !== 'https:' || url.pathname !== '/github' || url.search || url.hash || url.username || url.password) {
  throw new Error('Provide the public HTTPS receiver URL ending in /github, without query parameters.')
}
async function gh(args, payload) {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = '', err = ''
    child.stdout.on('data', (s) => { out += s })
    child.stderr.on('data', (s) => { err += s })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code) reject(new Error(`GitHub operation failed (${code}): ${err.replaceAll(secret, '[redacted]')}`))
      else { try { resolve(JSON.parse(out)) } catch { reject(new Error('GitHub returned invalid JSON')) } }
    })
    child.stdin.end(payload ? JSON.stringify(payload) : undefined)
  })
}
const hooks = await gh(['api', `repos/${repository}/hooks?per_page=100`])
const existing = hooks.find((h) => h.config?.url === url.href)
if (existing) {
  console.log(`Webhook #${existing.id} already exists. No changes made; check its secret and Issues subscription in GitHub.`)
} else {
  const hook = await gh(['api', `repos/${repository}/hooks`, '--method', 'POST', '--input', '-'], {
    name: 'web', active: true, events: ['issues'],
    config: { url: url.href, content_type: 'json', secret, insecure_ssl: '0' },
  })
  console.log(`Created webhook #${hook.id} for ${repository}; Issues events enabled; secret not displayed.`)
}
console.log(`Inspect deliveries: https://github.com/${repository}/settings/hooks`)
