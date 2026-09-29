import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-devrel-toolkit'

// Cordis defers apply() until the `tools` service exists, and tears it back
// down if that service goes away. Without this line, reading ctx.tools throws.
export const inject = ['tools']

export function apply(ctx: Context) {
  // register() returns a disposer, but the plugin's own context owns it —
  // unloading this plugin unregisters the tool automatically.
  ctx.tools.register(defineTool({
    name: 'analyze_feedback',
    description: 'Classify developer feedback and suggest information to collect.',
    // Parameter names are the keys; requiredness is a per-key annotation.
    parameters: {
      feedback: { type: 'string', required: true, description: 'Raw developer feedback' },
    },
    output: {
      // execute() returns this canonical value; render() turns it into the
      // content blocks the model actually sees.
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      const feedback = args.feedback.toLowerCase()

      // Cordis throws `cannot get property "tools" without inject` — that text
      // never mentions `ctx.tools`, so it has to be its own trigger.
      if (feedback.includes('without inject') ||
          (feedback.includes('ctx.tools') &&
           (feedback.includes('undefined') || feedback.includes('not available')))) {
        return [
          'Category: Plugin dependency',
          "Possible cause: The plugin may be using ctx.tools without declaring inject = ['tools'].",
          'Information to collect:',
          '- DSH version',
          '- plugin source',
          '- cordis.yml',
          '- complete error message',
          "Suggested next step: Verify that the plugin exports inject = ['tools'].",
        ].join('\n')
      }

      return [
        'Category: Unclassified developer feedback',
        'Information to collect:',
        '- Expected behavior',
        '- Actual behavior',
        '- Steps to reproduce',
        '- DSH version',
        '- Relevant configuration',
      ].join('\n')
    },
  }))
}
