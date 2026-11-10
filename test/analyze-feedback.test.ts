import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as plugin from '../src/analyze-feedback.ts'

/** Run apply() against a stub so a test can reach the tool definition directly. */
function registeredTool() {
  let captured: any
  plugin.apply({ tools: { register: (def: any) => (captured = def, () => {}) } } as any)
  return captured
}

/** First line of a result, minus the `Category: ` prefix. */
async function categoryOf(feedback: string) {
  const text: string = await registeredTool().execute({ feedback })
  return text.split('\n')[0].replace('Category: ', '')
}

describe('plugin contract', () => {
  it('exports the module-namespace plugin shape cordis expects', () => {
    assert.equal(plugin.name, 'dsh-devrel-toolkit')
    assert.deepEqual(plugin.inject, ['tools'])
    assert.equal(typeof plugin.apply, 'function')
  })

  it('has no default export, which would shadow the injection metadata', () => {
    assert.equal((plugin as any).default, undefined)
  })
})

describe('classification', () => {
  const PLUGIN_DEPENDENCY = 'Plugin dependency'
  const UNCLASSIFIED = 'Unclassified developer feedback'

  const cases: [string, string, string][] = [
    // The message cordis actually throws. It never says `ctx.tools`, so it has
    // to match on its own rather than behind the ctx.tools guard.
    ['the real cordis error', 'Error: cannot get property "tools" without inject', PLUGIN_DEPENDENCY],
    ['ctx.tools + undefined', 'ctx.tools is undefined when my plugin loads', PLUGIN_DEPENDENCY],
    ['ctx.tools + not available', 'ctx.tools not available', PLUGIN_DEPENDENCY],
    ['mixed case', 'Cannot Get Property "tools" WITHOUT INJECT', PLUGIN_DEPENDENCY],
    ['unrelated feedback', 'the docs are confusing', UNCLASSIFIED],
    // ctx.tools alone is not a fault report — guard against over-matching.
    ['ctx.tools mentioned approvingly', 'I like how ctx.tools works', UNCLASSIFIED],
    ['a symptom with no subject', 'it is undefined', UNCLASSIFIED],
  ]

  for (const [label, feedback, expected] of cases) {
    it(`classifies ${label} as "${expected}"`, async () => {
      assert.equal(await categoryOf(feedback), expected)
    })
  }

  it('always returns a checklist the maintainer can act on', async () => {
    for (const [, feedback] of cases) {
      const text: string = await registeredTool().execute({ feedback })
      assert.match(text, /^Category: /)
      assert.match(text, /Information to collect:\n- /)
    }
  })
})

describe('registration against the real tool runtime', () => {
  it('reaches ACTIVE and exposes the tool once `tools` is provided', async () => {
    const ctx = new Context()
    ctx.plugin(SystemPrompt)
    ctx.plugin(ToolRuntime)
    const fiber = ctx.plugin(plugin)

    await new Promise((resolve) => setTimeout(resolve, 500))

    // 2 is FiberState.ACTIVE — 0 (PENDING) means inject never resolved, which
    // is the silent failure mode: apply() simply never runs.
    assert.equal(fiber.state, 2)
    assert.deepEqual(ctx.tools.schemas().map((s: any) => s.name), ['analyze_feedback'])
  })

  it('sends only name, description and parameters to the model', async () => {
    const ctx = new Context()
    ctx.plugin(SystemPrompt)
    ctx.plugin(ToolRuntime)
    ctx.plugin(plugin)

    await new Promise((resolve) => setTimeout(resolve, 500))

    const schema: any = ctx.tools.schemas()[0]
    assert.deepEqual(Object.keys(schema).sort(), ['description', 'name', 'parameters'])
    assert.deepEqual(schema.parameters.required, ['feedback'])
    assert.equal(schema.parameters.properties.feedback.type, 'string')
  })
})

describe('output rendering', () => {
  it('renders the canonical string as a single text block', async () => {
    const tool = registeredTool()
    const value: string = await tool.execute({ feedback: 'anything' })

    assert.deepEqual(tool.output.render({ feedback: 'anything' }, value), [
      { type: 'text', text: value },
    ])
  })
})
