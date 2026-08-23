/**
 * dsh-output-styles — host half (composition plugin).
 *
 * Registers a configurable `output-style` section in the host `systemPrompt`
 * registry (order 5, right after the persona). The section text is a provider
 * evaluated at EVERY prompt assembly, so a style change applies from the next
 * model step without restarting anything. The selected style lives in the
 * `output-styles` settings namespace (~/.dsh/settings.yaml) and therefore
 * survives `dsh web` restarts.
 *
 * Mounts the `outputStyles` Typert remote service that the browser half
 * (lib/client.js) calls to read and change the selection. Composition row:
 *
 *   - insert:
 *       - id: output-styles
 *         name: 'dsh-output-styles'
 */
import z from '@deepseek-ai/schemastery'
import {
  GetResultCodec,
  MAX_CUSTOM_LENGTH,
  NAMESPACE,
  OutputStyleGateway,
  PACKAGE,
  PRESETS,
  isKnownMode,
  promptFor,
} from './remote.js'

export const name = 'output-styles'
export const inject = ['settings', 'systemPrompt']

const ConfigSchema = z.object({
  /** Selected preset id (`default`, `concise`, `explanatory`, `learning`, `formal`, `custom`). */
  mode: z.string().default('default'),
  /** Free-form style instructions, used when mode is `custom`. */
  custom: z.string().default(''),
})

function readState(ctx) {
  const value = ctx.settings.get(NAMESPACE)
  const mode = value && typeof value.mode === 'string' && isKnownMode(value.mode) ? value.mode : 'default'
  const custom = value && typeof value.custom === 'string' ? value.custom : ''
  return { mode, custom }
}

export function apply(ctx) {
  // Durable, schema-validated selection. The system-prompt section below reads
  // this namespace at every assembly, so `applies: 'live'` is literal: the next
  // model step sees a change as soon as it commits.
  ctx.settings.register(NAMESPACE, ConfigSchema, {
    applies: 'live',
    validate: (value) => {
      if (!isKnownMode(value.mode)) throw new Error(`${PACKAGE}: unknown mode "${value.mode}"`)
    },
  })

  // Global prompt contribution: applies to every agent and session on this
  // deployment. Empty text for `default` renders nothing.
  ctx.systemPrompt.section({
    name: 'output-style',
    order: 5,
    text: () => {
      const { mode, custom } = readState(ctx)
      const body = promptFor(mode, custom)
      if (body === '') return ''
      return (
        '## Output Style\n\n' +
        'The user has configured the following output style. Adapt the tone, structure, ' +
        'and level of detail of every natural-language response to match it:\n\n' +
        body
      )
    },
  })

  // The Typert loader discovers this package's host manifest; the gateway
  // supplies its implementations under the matching outputStyles service key.
  const controller = {
    async get() {
      const { mode, custom } = readState(ctx)
      return GetResultCodec.schema.parse({
        mode,
        custom,
        presets: PRESETS.map((preset) => ({
          id: preset.id,
          label: preset.label,
          description: preset.description,
        })),
      })
    },

    async set(mode, custom) {
      if (!isKnownMode(mode)) throw new Error(`${PACKAGE}: unknown mode "${mode}"`)
      const patch = { mode, custom: String(custom || '').slice(0, MAX_CUSTOM_LENGTH) }
      await ctx.settings.update(NAMESPACE, patch)
      return { ok: true }
    },
  }
  if (ctx.typert !== undefined) new OutputStyleGateway(ctx, controller)
  ctx.logger.info(`[${PACKAGE}] outputStyles remote service mounted (settings namespace: ${NAMESPACE})`)
}
