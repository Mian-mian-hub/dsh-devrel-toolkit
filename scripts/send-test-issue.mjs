import { createHmac, randomUUID } from 'node:crypto'

const repository = process.env.DEVREL_GITHUB_REPOSITORIES?.split(',')[0]?.trim()
const secret = process.env.DSH_GITHUB_WEBHOOK_SECRET
if (!repository || !secret) {
  console.error('Set DEVREL_GITHUB_REPOSITORIES and DSH_GITHUB_WEBHOOK_SECRET in this terminal first.')
  process.exit(1)
}
const port = Number(process.env.DEVREL_WEBHOOK_PORT ?? 3081)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid DEVREL_WEBHOOK_PORT')
const deliveryId = randomUUID()
const payload = JSON.stringify({
  action: 'opened', repository: { full_name: repository },
  issue: {
    id: 1, number: 1, title: '[LOCAL TEST] Plugin loads without exposing its tool',
    body: 'Synthetic local test, not a real GitHub Issue. ctx.tools is undefined when my plugin loads. What information is missing?',
    user: { login: 'local-demo' }, labels: [],
  },
})
// This command intentionally targets loopback only. It creates an analysis Session
// and can consume model tokens; it never creates a GitHub Issue.
const response = await fetch(`http://127.0.0.1:${port}/github`, {
  method: 'POST', signal: AbortSignal.timeout(15000),
  headers: {
    'content-type': 'application/json', 'x-github-event': 'issues',
    'x-github-delivery': deliveryId,
    'x-hub-signature-256': 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex'),
  },
  body: payload,
})
if (response.status !== 202) {
  console.error(`Webhook rejected: ${response.status} ${await response.text()}`)
  process.exit(1)
}
console.log(`Accepted local test delivery ${deliveryId}.`)
console.log('202 means accepted, not analysis success. Check DSH for a Triage ...#1 Session and its model response.')
