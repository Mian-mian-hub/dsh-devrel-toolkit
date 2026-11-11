import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'

// Keep this entry point in JavaScript so older Node versions get an actionable
// error before trying to parse the plugin's TypeScript source.
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 18)) {
  console.error('Node.js 22.18+ is required. Install Node 22 LTS or 24 LTS, then run npm ci again.')
  process.exit(1)
}

let ctx
try {
  const [{ Context }, { default: SystemPrompt }, { default: ToolRuntime }, plugin] = await Promise.all([
    import('@deepseek-ai/cordis'),
    import('@deepseek-ai/dsh-system-prompt'),
    import('@deepseek-ai/dsh-tools'),
    import('../src/index.ts'),
  ])
  ctx = new Context()
  ctx.plugin(SystemPrompt)
  ctx.plugin(ToolRuntime)
  const fiber = ctx.plugin(plugin)
  const deadline = Date.now() + 3000
  while (fiber.state !== 2 && Date.now() < deadline) await setTimeout(20)
  assert.equal(fiber.state, 2, 'Plugin did not reach ACTIVE; check the tools service and DSH versions.')
  const tool = ctx.tools.get('analyze_feedback')
  assert.ok(tool, 'analyze_feedback was not registered.')
  const args = { feedback: 'ctx.tools is undefined when my plugin loads.' }
  const value = await tool.execute(args)
  assert.match(value, /^Category: Plugin dependency\n/)
  assert.deepEqual(tool.output.render(args, value), [{ type: 'text', text: value }])
  console.log(`OK: Node ${process.versions.node}; plugin ACTIVE; analyze_feedback executed and rendered.`)
  console.log(value)
} catch (error) {
  console.error('Install check failed. Run npm ci from the repository root and retry npm run check.')
  console.error(error)
  process.exitCode = 1
} finally {
  await ctx?.fiber.dispose()
}
