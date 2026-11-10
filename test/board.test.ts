import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout } from 'node:timers/promises'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods, isRemoteJsonValue } from '@deepseek-ai/dsh-typert-protocol'
import Board, { decodeAnalysis } from '../src/board.ts'

const analysis = { intent: 'support_request', areas: ['configuration'], resolution: 'not_searched', summary: '缺少版本信息，暂不能确定原因。',
  nextAction: '提供版本和原始错误。', missingInformation: ['DSH 版本'], productSignal: '暂无充分依据' }
const issue = { repository: 'example/repo', issueId: 100, number: 1, title: 'Help', body: 'Untrusted input', isDemo: false, deliveryId: 'delivery' }
async function waitFor(check: () => boolean) {
  for (let n = 0; !check() && n < 150; n++) await setTimeout(10)
  assert.ok(check(), 'Timed out waiting for worker')
}
test('validates structured output and discards undeclared fields', () => {
  assert.deepEqual(decodeAnalysis('```json\n' + JSON.stringify({ ...analysis, extra: 'ignore' }) + '\n```'), analysis)
  for (const change of [{ intent: 'invented' }, { resolution: 'solved' }, { missingInformation: [1] }, { areas: ['bad'] }, { summary: 'x'.repeat(301) }]) {
    assert.throws(() => decodeAnalysis(JSON.stringify({ ...analysis, ...change })))
  }
})
test('deduplicates, persists, retries and makes bounded LLM calls without Agent services', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'devrel-board-')), file = join(dir, 'board.json')
  t.after(() => rm(dir, { recursive: true, force: true }))
  let calls = 0, invalid = true
  const ctx = new Context()
  ctx.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'test', model: 'fake' }) } as any)
  ctx.provide('llm', { async *stream(request: any) {
    calls++; assert.equal(request.maxTokens, 1000); assert.equal(request.reasoningEffort, 'off'); assert.deepEqual(request.tools, [])
    yield { type: 'text-delta', text: invalid ? 'invalid' : JSON.stringify(analysis) }
    yield { type: 'usage', usage: { inputTokens: 100, outputTokens: 60 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  } } as any)
  try {
    ctx.plugin(Board, { repositories: ['example/repo'], dataFile: file })
    await waitFor(() => !!(ctx as any).devrelBoard)
    const board = (ctx as any).devrelBoard
    const first = await board.enqueue(issue)
    assert.equal((await board.enqueue({ ...issue, deliveryId: 'redelivery' })).duplicate, true)
    await waitFor(() => board.records[0]?.status === 'failed')
    invalid = false
    await board.retry(first.id)
    await waitFor(() => board.records[0]?.status === 'done')
    const result = await board.list()
    assert.equal(result.counts.done, 1); assert.equal(calls, 2)
    assert.equal('body' in result.records[0].issue, false)
    assert.ok(isRemoteJsonValue(result)); assert.deepEqual((await board.get(first.id)).analysis, analysis)
    await assert.rejects(() => board.retry(first.id), /Only failed/)
    assert.deepEqual(remoteMethods(board).map((x: any) => x.method), ['list', 'get', 'retry'])
  } finally { await ctx.fiber.dispose() }
  const saved = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(saved.records[0].status, 'done')
  saved.records.push({ ...saved.records[0], id: 'interrupted', status: 'running' })
  await writeFile(file, JSON.stringify(saved))
  const second = new Context()
  second.provide('agentDefaultModel', {} as any); second.provide('llm', {} as any)
  try {
    second.plugin(Board, { repositories: ['example/repo'], dataFile: file })
    await waitFor(() => !!(second as any).devrelBoard)
    const rows = await (second as any).devrelBoard.list()
    assert.equal(rows.counts.done, 1); assert.equal(rows.counts.failed, 1)
  } finally { await second.fiber.dispose() }
})
