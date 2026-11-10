import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { Readable } from 'node:stream'
import { setTimeout } from 'node:timers/promises'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import * as adapter from '@deepseek-ai/dsh-webhook-github'
import * as plugin from '../src/github-issues.ts'

const config = { source: 'devrel-github', repositories: ['Mian-mian-hub/dsh-devrel-toolkit'], maxBodyChars: 256 }
function delivery(change: any = {}) {
  return {
    kind: 'github', source: config.source, deliveryId: 'test-delivery', receivedAt: Date.now(),
    event: { name: 'issues', payload: {
      action: 'opened', repository: { full_name: config.repositories[0] },
      issue: { id: 123, number: 7, title: 'Plugin silently fails', body: 'ctx.tools is undefined', labels: [], user: { login: 'reporter' } },
    } }, ...change,
  } as any
}
const parse = (item: any) => plugin.parseIssue(item, config.repositories, config.source, config.maxBodyChars)

test('filters by source, repository, event and action; does not treat PRs as Issues', () => {
  for (const item of [
    delivery({ kind: 'other' }), delivery({ source: 'other' }),
    delivery({ event: { name: 'ping', payload: {} } }),
    delivery({ event: { name: 'issue_comment', payload: { action: 'created' } } }),
    delivery({ event: { name: 'issues', payload: { ...delivery().event.payload, action: 'edited' } } }),
    delivery({ event: { name: 'issues', payload: { ...delivery().event.payload, repository: { full_name: 'other/repo' } } } }),
    delivery({ event: { name: 'issues', payload: { ...delivery().event.payload, issue: { ...delivery().event.payload.issue, pull_request: {} } } } }),
  ]) assert.equal(parse(item), null)
})

test('bounds untrusted text and canonicalizes links; demos have no Issue URL', () => {
  const item = delivery()
  item.event.payload.issue.body = 'x'.repeat(1000)
  item.event.payload.issue.html_url = 'https://attacker.example'
  const result = parse(item)!
  assert.equal(result.body.length, 256)
  assert.equal(result.bodyTruncated, true)
  assert.equal(result.url, `https://github.com/${config.repositories[0]}/issues/7`)
  item.event.payload.issue.devrelDemo = true
  assert.equal(parse(item)?.url, null)
  assert.equal(parse(item)?.number, null)
  assert.equal(parse(item)?.isDemo, true)
  for (const change of [{ id: -1 }, { number: 1.5 }, { title: '' }, { body: {} }]) {
    const bad = delivery(); Object.assign(bad.event.payload.issue, change)
    assert.throws(() => parse(bad), /Malformed/)
  }
})

test('signed HTTP delivery passes through official adapter/runtime to the board without Agent/Session services; invalid signature does not', async () => {
  const ctx = new Context()
  const admissions: any[] = []
  let route: any
  const secret = 'test-only-not-a-deployment-secret'
  ctx.provide('webServer', { register(value: any) { route = value; return () => { route = undefined } } } as any)
  ctx.provide('credentials', { resolve: async () => ({ value: secret }) } as any)
  ctx.provide('devrelBoard', { config, enqueue: async (issue: any) => { admissions.push(issue) } } as any)

  try {
    const rule = ctx.plugin(plugin, config)
    ctx.plugin(adapter, { source: config.source, path: '/github', secretEnv: 'DSH_GITHUB_WEBHOOK_SECRET', maxBodyBytes: 1048576 })
    for (let n = 0; !route && n < 50; n++) await setTimeout(10)
    assert.equal(rule.state, 2)
    assert.equal(route.path, '/github')
    const send = async (event: string, payload: any, valid = true) => {
      const body = JSON.stringify(payload)
      const signature = 'sha256=' + createHmac('sha256', valid ? secret : 'wrong').update(body).digest('hex')
      const req: any = Readable.from([Buffer.from(body)])
      req.method = 'POST'; req.complete = true
      req.headers = { 'content-type': 'application/json' }
      req.headersDistinct = { 'x-hub-signature-256': [signature], 'x-github-delivery': ['test-delivery'], 'x-github-event': [event] }
      let status: number | undefined
      await route.handler(req, { writeHead: (s: number) => { status = s }, end() {}, setHeader() {} })
      return status
    }
    assert.equal(await send('issues', delivery().event.payload, false), 401)
    assert.equal(admissions.length, 0)
    assert.equal(await send('ping', { zen: 'test' }), 202)
    await setTimeout(20)
    assert.equal(admissions.length, 0)
    assert.equal(await send('issues', delivery().event.payload), 202)
    for (let n = 0; !admissions.length && n < 100; n++) await setTimeout(10)
    assert.equal(admissions.length, 1)
    assert.equal(admissions[0].number, 7)
    assert.equal(admissions[0].deliveryId, 'test-delivery')
    rule.dispose()
    await setTimeout(20)
    assert.equal(route, undefined, 'Unloading the bridge also unloads the adapter dependency.')
    assert.equal(admissions.length, 1, 'Unloading the rule must unregister its callback.')
  } finally {
    await ctx.fiber.dispose()
  }
})
