/**
 * Shared contract for dsh-output-styles: the preset catalog (single source of
 * truth, imported by the host half and mirrored by the client half), the strict
 * JSON codecs, the host Typert invocation manifest (discovered through this
 * package's `./typert` export), and the gateway service wrapper (service key
 * `outputStyles`).
 *
 * Codecs follow dsh-typert's runtime contract: `schema.parse(value)` with the
 * `_zod` marker satisfying the loader's shape check. Every value crossing the
 * wire is detached, JSON-safe data — never live Cordis or settings objects.
 */
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

export const PACKAGE = 'dsh-output-styles'
export const SERVICE = 'outputStyles'
export const NAMESPACE = 'output-styles'
export const MAX_CUSTOM_LENGTH = 4000

/** Built-in output styles. `prompt` is the body injected into the system prompt. */
export const PRESETS = [
  {
    id: 'default',
    label: 'Default',
    description: 'No output-style instructions are added to the system prompt.',
    prompt: '',
  },
  {
    id: 'concise',
    label: 'Concise',
    description: 'Short, telegraphic answers: result first, minimal prose, no recaps.',
    prompt:
      'Keep every response brief and telegraphic. Lead with the answer or the action taken. ' +
      'Do not restate the request, do not announce what you are about to do, and do not close ' +
      'with a summary. Prefer tight bullet lists and code blocks over prose paragraphs.',
  },
  {
    id: 'explanatory',
    label: 'Explanatory',
    description: 'Adds reasoning: why an approach was chosen, alternatives, and tradeoffs.',
    prompt:
      'After completing each task, briefly explain your reasoning: why you chose this approach, ' +
      'which alternatives you considered and rejected, and the tradeoffs involved. ' +
      'Explicitly flag any assumptions you had to make. Keep these explanations compact and ' +
      'separate from the result itself.',
  },
  {
    id: 'learning',
    label: 'Learning',
    description: 'Teaches while working: explains concepts and points out best practices.',
    prompt:
      'Teach while you work. Explain concepts as they come up, point out best practices and ' +
      'common pitfalls relevant to the current task, and when the task has an educational ' +
      'component, describe what the user could implement themselves before you fill in the rest. ' +
      'Keep teaching notes concise so the work itself stays front and center.',
  },
  {
    id: 'formal',
    label: 'Formal',
    description: 'Structured, documentation-tone responses with clear headings.',
    prompt:
      'Write responses in a formal, documentation-like register. Use clear section headings, ' +
      'precise terminology, numbered lists for procedures, and complete sentences. ' +
      'Avoid colloquialisms and first-person asides.',
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Write your own style instructions below.',
    prompt: '',
  },
]

const PRESET_IDS = new Set(PRESETS.map((preset) => preset.id))

export function isKnownMode(mode) {
  return PRESET_IDS.has(mode)
}

export function promptFor(mode, custom) {
  if (mode === 'custom') return String(custom || '').trim()
  const preset = PRESETS.find((entry) => entry.id === mode)
  return preset ? preset.prompt : ''
}

// ---------------------------------------------------------------------------
// Codecs
// ---------------------------------------------------------------------------

function fail(message) {
  throw new Error(`${PACKAGE} remote: ${message}`)
}

/** Minimal strict codec accepted by Typert on both Host and Client. */
function codec(typeSymbol, parse) {
  return Object.freeze({ mode: 'strict', typeSymbol, schema: Object.freeze({ _zod: {}, parse }) })
}

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`)
  return value
}
function string(value, label) {
  if (typeof value !== 'string') fail(`${label} must be a string`)
  return value
}
function bool(value, label) {
  if (typeof value !== 'boolean') fail(`${label} must be a boolean`)
  return value
}
function arrayOf(item, value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`)
  return value.map((entry, i) => item(entry, `${label}[${i}]`))
}
function onlyKeys(object, keys, label) {
  for (const key of Object.keys(object)) if (!keys.includes(key)) fail(`${label}.${key} is not allowed`)
}

export const StyleInfoCodec = codec(`${PACKAGE}/StyleInfo`, (value) => {
  const v = record(value, 'style')
  onlyKeys(v, ['id', 'label', 'description'], 'style')
  return {
    id: string(v.id, 'style.id'),
    label: string(v.label, 'style.label'),
    description: string(v.description, 'style.description'),
  }
})

export const GetResultCodec = codec(`${PACKAGE}/GetResult`, (value) => {
  const v = record(value, 'get result')
  onlyKeys(v, ['mode', 'custom', 'presets'], 'get result')
  return {
    mode: string(v.mode, 'get.mode'),
    custom: string(v.custom, 'get.custom'),
    presets: arrayOf((x) => StyleInfoCodec.schema.parse(x), v.presets, 'get.presets'),
  }
})

export const OkResultCodec = codec(`${PACKAGE}/OkResult`, (value) => {
  const v = record(value, 'op result')
  onlyKeys(v, ['ok'], 'op result')
  return { ok: bool(v.ok, 'op.ok') }
})

const ModeParam = codec(`${PACKAGE}/Mode`, (value) => string(value, 'mode'))
const CustomParam = codec(`${PACKAGE}/Custom`, (value) => string(value, 'custom'))

// ---------------------------------------------------------------------------
// Host Typert manifest
// ---------------------------------------------------------------------------

function param(name, c) {
  return { name, wire: name, source: 'json', codec: { mode: 'strict', typeSymbol: c.typeSymbol, schema: c.schema } }
}
function result(c) {
  return { mode: 'strict', typeSymbol: c.typeSymbol, schema: c.schema }
}
function invocation(method, parameters, res) {
  return {
    id: `${PACKAGE}#${SERVICE}/${method}`,
    service: SERVICE,
    namespace: SERVICE,
    method,
    invocation: { kind: 'direct' },
    parameters,
    result: res,
  }
}

/** Host manifest discovered by dsh-typert-loader from this package's ./typert export. */
export const TYPERT = Object.freeze({
  package: PACKAGE,
  face: 'host',
  schemas: [],
  invocations: [
    invocation('get', [], result(GetResultCodec)),
    invocation('set', [param('mode', ModeParam), param('custom', CustomParam)], result(OkResultCodec)),
  ],
  model: { services: [], events: [], objects: [] },
})

// ---------------------------------------------------------------------------
// Gateway
// ---------------------------------------------------------------------------

const remoteInitializers = []
function markRemote(ctor, method) {
  Remote(method)(ctor.prototype[method], {
    kind: 'method',
    name: method,
    static: false,
    private: false,
    addInitializer(initializer) {
      remoteInitializers.push(initializer)
    },
  })
}

const METHODS = ['get', 'set']

/** Typert service wrapper over the host controller's operational interface. */
export class OutputStyleGateway extends TypertRemoteService {
  constructor(ctx, controller) {
    super(ctx, SERVICE)
    this.controller = controller
    for (const initializer of remoteInitializers) initializer.call(this)
  }
  get() { return this.controller.get() }
  set(mode, custom) { return this.controller.set(mode, custom) }
}
for (const method of METHODS) markRemote(OutputStyleGateway, method)
