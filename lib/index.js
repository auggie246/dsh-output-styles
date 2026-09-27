/**
 * Persistent output styles for DeepSeek Harness Web.
 *
 * Built-in styles and user-created styles share one selector. User-created
 * styles live in this plugin's own Config (the `output-styles` profile entry
 * in the profile patch), so they persist across restarts.
 */
import { randomUUID } from 'node:crypto'
import z from '@deepseek-ai/schemastery'
import {
  GetResultCodec,
  MAX_STYLE_DESCRIPTION_LENGTH,
  MAX_STYLE_INSTRUCTIONS_LENGTH,
  MAX_STYLE_NAME_LENGTH,
  MAX_USER_STYLES,
  NAMESPACE,
  OutputStyleGateway,
  PACKAGE,
  PRESETS,
  isBuiltInStyle,
  isKnownStyle,
  isUserStyleId,
  promptFor,
  readStoredState,
  resolveStyleDraft,
} from './remote.js'

export const name = 'output-styles'
export const inject = ['settings', 'systemPrompt', 'typert']

const UserStyleSchema = z.object({
  id: z.string(),
  name: z.string(),
  instructions: z.string(),
  description: z.string().default(''),
})

// Editable fields are `volatile()` references: a write through the Settings
// service updates them in place instead of remounting this plugin, so the
// prompt section re-reads the live value on the next assembly.
export const Config = z.object({
  /** Current field. It is optional so an old `mode: custom` value can migrate. */
  selectedId: z.string().default('default').volatile(),
  userStyles: z.array(UserStyleSchema).default([]).volatile(),
  /** Legacy fields from 0.1.0. They remain readable during automatic migration. */
  mode: z.string().default('default'),
  custom: z.string().default(''),
})

function validateUserStyles(userStyles) {
  if (!Array.isArray(userStyles)) throw new Error(`${PACKAGE}: userStyles must be an array`)
  if (userStyles.length > MAX_USER_STYLES) {
    throw new Error(`${PACKAGE}: no more than ${MAX_USER_STYLES} user styles are allowed`)
  }
  const ids = new Set()
  for (const style of userStyles) {
    if (!isUserStyleId(style.id)) throw new Error(`${PACKAGE}: invalid user style id "${style.id}"`)
    if (ids.has(style.id)) throw new Error(`${PACKAGE}: duplicate user style id "${style.id}"`)
    if (isBuiltInStyle(style.id)) throw new Error(`${PACKAGE}: user style id conflicts with a built-in style`)
    if (style.name.trim() === '') throw new Error(`${PACKAGE}: user style name is required`)
    if (style.name.length > MAX_STYLE_NAME_LENGTH) {
      throw new Error(`${PACKAGE}: user style name exceeds ${MAX_STYLE_NAME_LENGTH} characters`)
    }
    if (style.instructions.trim() === '') throw new Error(`${PACKAGE}: user style instructions are required`)
    if (style.instructions.length > MAX_STYLE_INSTRUCTIONS_LENGTH) {
      throw new Error(`${PACKAGE}: user style instructions exceed ${MAX_STYLE_INSTRUCTIONS_LENGTH} characters`)
    }
    const description = typeof style.description === 'string' ? style.description : ''
    if (description.length > MAX_STYLE_DESCRIPTION_LENGTH) {
      throw new Error(`${PACKAGE}: user style description exceeds ${MAX_STYLE_DESCRIPTION_LENGTH} characters`)
    }
    ids.add(style.id)
  }
}

function validateDraft(name, instructions, description) {
  try {
    return resolveStyleDraft(name, instructions, description)
  } catch (error) {
    throw new Error(`${PACKAGE}: ${error.message}`)
  }
}

export function apply(ctx, config) {
  // Settings addresses a namespace by the plugin's profile entry id, which is
  // `output-styles` for a normal bundle install but can differ in a hand-wired
  // composition. Fall back to the canonical id when no entry is attached.
  const namespace = ctx.fiber?.entry?.options.id ?? NAMESPACE

  // Volatile fields arrive as live references; read `.get()` for the current
  // value. They stay valid for this plugin instance's lifetime.
  const readState = () =>
    readStoredState({
      selectedId: config.selectedId.get(),
      userStyles: config.userStyles.get(),
      mode: config.mode,
      custom: config.custom,
    })

  ctx.systemPrompt.section({
    name: 'output-style',
    order: 5,
    text: () => {
      const { selectedId, userStyles } = readState()
      const body = promptFor(selectedId, userStyles)
      if (body === '') return ''
      return (
        '## Output Style\n\n' +
        'The user has configured the following output style. Adapt the tone, structure, ' +
        'and level of detail of every natural-language response to match it:\n\n' +
        body
      )
    },
  })

  function resultFor(state = readState()) {
    return GetResultCodec.create().parse({
      selectedId: state.selectedId,
      presets: PRESETS.map((preset) => ({
        id: preset.id,
        label: preset.label,
        description: preset.description,
      })),
      userStyles: state.userStyles,
    })
  }

  // Settings writes are serialized through the service's own write chain.
  // A patch names only the volatile fields this plugin owns.
  async function persist(selectedId, userStyles) {
    validateUserStyles(userStyles)
    await ctx.settings.update(namespace, { selectedId, userStyles })
    return resultFor({ selectedId, userStyles })
  }

  let mutationTail = Promise.resolve()
  function mutate(callback) {
    const operation = mutationTail.then(callback, callback)
    mutationTail = operation.then(() => undefined, () => undefined)
    return operation
  }

  const controller = {
    async get() {
      return resultFor()
    },

    async select(styleId) {
      return mutate(async () => {
        const { userStyles } = readState()
        if (!isKnownStyle(styleId, userStyles)) throw new Error(`${PACKAGE}: unknown style "${styleId}"`)
        return persist(styleId, userStyles)
      })
    },

    async save(styleId, name, instructions, description) {
      const draft = validateDraft(name, instructions, description)
      return mutate(async () => {
        const state = readState()
        const userStyles = state.userStyles.map((style) => ({ ...style }))

        if (styleId === '') {
          if (userStyles.length >= MAX_USER_STYLES) {
            throw new Error(`${PACKAGE}: no more than ${MAX_USER_STYLES} user styles are allowed`)
          }
          styleId = `user:${randomUUID()}`
          userStyles.push({ id: styleId, ...draft })
        } else {
          const index = userStyles.findIndex((style) => style.id === styleId)
          if (index === -1) throw new Error(`${PACKAGE}: unknown user style "${styleId}"`)
          userStyles[index] = { id: styleId, ...draft }
        }

        return persist(styleId, userStyles)
      })
    },

    async deleteStyle(styleId) {
      return mutate(async () => {
        const state = readState()
        const userStyles = state.userStyles.filter((style) => style.id !== styleId)
        if (userStyles.length === state.userStyles.length) {
          throw new Error(`${PACKAGE}: unknown user style "${styleId}"`)
        }
        const selectedId = state.selectedId === styleId ? 'default' : state.selectedId
        return persist(selectedId, userStyles)
      })
    },
  }

  // Suppress the auto-generated form page: this plugin ships its own
  // Settings page, so a schema-derived duplicate would double-register the
  // `output-styles` section.
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })

  const initial = readState()
  if (initial.migrated) {
    void ctx.settings
      .update(namespace, { selectedId: initial.selectedId, userStyles: initial.userStyles })
      .catch((error) => ctx.logger.warn(`[${PACKAGE}] failed to migrate the legacy custom style: ${error}`))
  }

  if (ctx.typert !== undefined) new OutputStyleGateway(ctx, controller)
  ctx.logger.info(`[${PACKAGE}] outputStyles remote service mounted (settings namespace: ${namespace})`)
}
