import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout } from 'node:timers/promises'
import Board from '../dist/index.js'
const scratch = await mkdtemp(join(tmpdir(), 'devrel-check-')), ctx = new Context()
try {
  ctx.provide('llm', {})
  ctx.provide('agentDefaultModel', {})
  const fiber = ctx.plugin(Board, { repositories: [], dataFile: join(scratch, 'board.json') })
  for (let n = 0; fiber.state !== 2 && n < 100; n++) await setTimeout(10)
  assert.equal(fiber.state, 2)
  assert.deepEqual(remoteMethods(ctx.devrelBoard).map(x => x.method), ['list', 'get', 'retry'])
  assert.equal((await ctx.devrelBoard.list()).records.length, 0)
  console.log('OK: compiled dashboard ACTIVE; RPC registered; no Agent or conversation tools required.')
} finally { await ctx.fiber.dispose(); await rm(scratch, { recursive: true, force: true }) }
