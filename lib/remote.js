/**
 * Typert contract for the persistent output-style catalog.
 *
 * Every wire value is detached JSON data. The browser half mirrors these
 * codecs because its lazy CJS factory cannot import this host module.
 */
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

export * from './catalog.js'

export const PACKAGE = 'dsh-output-styles'
export const SERVICE = 'outputStyles'
export const NAMESPACE = 'output-styles'

function fail(message) {
  throw new Error(`${PACKAGE} remote: ${message}`)
}

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

export const UserStyleCodec = codec(`${PACKAGE}/UserStyle`, (value) => {
  const v = record(value, 'user style')
  onlyKeys(v, ['id', 'name', 'instructions'], 'user style')
  return {
    id: string(v.id, 'userStyle.id'),
    name: string(v.name, 'userStyle.name'),
    instructions: string(v.instructions, 'userStyle.instructions'),
  }
})

export const GetResultCodec = codec(`${PACKAGE}/GetResult`, (value) => {
  const v = record(value, 'get result')
  onlyKeys(v, ['selectedId', 'presets', 'userStyles'], 'get result')
  return {
    selectedId: string(v.selectedId, 'get.selectedId'),
    presets: arrayOf((x) => StyleInfoCodec.schema.parse(x), v.presets, 'get.presets'),
    userStyles: arrayOf((x) => UserStyleCodec.schema.parse(x), v.userStyles, 'get.userStyles'),
  }
})

const StyleIdParam = codec(`${PACKAGE}/StyleId`, (value) => string(value, 'styleId'))
const NameParam = codec(`${PACKAGE}/Name`, (value) => string(value, 'name'))
const InstructionsParam = codec(`${PACKAGE}/Instructions`, (value) => string(value, 'instructions'))

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

export const TYPERT = Object.freeze({
  package: PACKAGE,
  face: 'host',
  schemas: [],
  invocations: [
    invocation('get', [], result(GetResultCodec)),
    invocation('select', [param('styleId', StyleIdParam)], result(GetResultCodec)),
    invocation(
      'save',
      [param('styleId', StyleIdParam), param('name', NameParam), param('instructions', InstructionsParam)],
      result(GetResultCodec)
    ),
    invocation('deleteStyle', [param('styleId', StyleIdParam)], result(GetResultCodec)),
  ],
  model: { services: [], events: [], objects: [] },
})

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

const METHODS = ['get', 'select', 'save', 'deleteStyle']

export class OutputStyleGateway extends TypertRemoteService {
  constructor(ctx, controller) {
    super(ctx, SERVICE)
    this.controller = controller
    for (const initializer of remoteInitializers) initializer.call(this)
  }
  get() { return this.controller.get() }
  select(styleId) { return this.controller.select(styleId) }
  save(styleId, name, instructions) { return this.controller.save(styleId, name, instructions) }
  deleteStyle(styleId) { return this.controller.deleteStyle(styleId) }
}
for (const method of METHODS) markRemote(OutputStyleGateway, method)
