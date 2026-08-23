/*
 * dsh-output-styles — browser half (composition client plugin).
 *
 * dsh-client-modules consumes prebuilt client halves as lazy CJS factories;
 * keep this wrapper format (rather than native ESM). The factory requires
 * `react` from the shared loader registry; Cordis services (`slots`, `remote`)
 * arrive through the plugin context declared in module.exports.inject.
 *
 * Registers an "Output Style" page in Settings (settings.section) whose
 * selection is read/written through the `outputStyles` Typert remote service
 * and persisted host-side in the `output-styles` settings namespace.
 */
window.__ModuleLoader__.load({
  id: 'dsh-output-styles',
  factory: (require) => {
    const module = { exports: {} }
    const React = require('react')
    const h = React.createElement
    const PACKAGE = 'dsh-output-styles'
    const SERVICE = 'outputStyles'

    // ------------------------------------------------------------------
    // Client Typert manifest mirroring lib/remote.js (deliberate duplicate:
    // the browser bundle cannot import the host module).
    // ------------------------------------------------------------------
    function fail(message) { throw new Error(`${PACKAGE} remote: ${message}`) }
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

    const StyleInfoCodec = codec(`${PACKAGE}/StyleInfo`, (value) => {
      const v = record(value, 'style')
      onlyKeys(v, ['id', 'label', 'description'], 'style')
      return {
        id: string(v.id, 'style.id'),
        label: string(v.label, 'style.label'),
        description: string(v.description, 'style.description'),
      }
    })
    const GetResultCodec = codec(`${PACKAGE}/GetResult`, (value) => {
      const v = record(value, 'get result')
      onlyKeys(v, ['mode', 'custom', 'presets'], 'get result')
      return {
        mode: string(v.mode, 'get.mode'),
        custom: string(v.custom, 'get.custom'),
        presets: arrayOf((x) => StyleInfoCodec.schema.parse(x), v.presets, 'get.presets'),
      }
    })
    const OkResultCodec = codec(`${PACKAGE}/OkResult`, (value) => {
      const v = record(value, 'op result')
      onlyKeys(v, ['ok'], 'op result')
      return { ok: bool(v.ok, 'op.ok') }
    })
    const ModeParam = codec(`${PACKAGE}/Mode`, (value) => string(value, 'mode'))
    const CustomParam = codec(`${PACKAGE}/Custom`, (value) => string(value, 'custom'))

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
    const TYPERT_REMOTE = Object.freeze({
      package: PACKAGE,
      descriptors: [
        invocation('get', [], result(GetResultCodec)),
        invocation('set', [param('mode', ModeParam), param('custom', CustomParam)], result(OkResultCodec)),
      ],
    })

    // ------------------------------------------------------------------
    // Plugin
    // ------------------------------------------------------------------
    const inject = ['slots', 'remote']

    /** Unwrap the { ok, value, error } envelope the remote bridge returns. */
    function remoteValue(result) {
      if (!result || !result.ok) throw new Error((result && result.error && result.error.message) || 'The DSH server rejected this request.')
      return result.value
    }

    const PAGE_CSS =
      '.cos-page{display:flex;flex-direction:column;gap:12px;max-width:42rem;padding:4px 0}' +
      '.cos-hint{margin:0;opacity:.75;line-height:1.5}' +
      '.cos-option{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;' +
      'border:1px solid rgba(128,128,128,.3);border-radius:8px;cursor:pointer}' +
      '.cos-option:hover{background:rgba(128,128,128,.08)}' +
      '.cos-option input{margin-top:3px}' +
      '.cos-option-body{display:flex;flex-direction:column;gap:2px}' +
      '.cos-option-label{font-weight:600}' +
      '.cos-option-desc{opacity:.7;font-size:.9em;line-height:1.4}' +
      '.cos-custom{font:inherit;resize:vertical;padding:10px 12px;border-radius:8px;' +
      'border:1px solid rgba(128,128,128,.3);background:transparent;color:inherit}' +
      '.cos-saved{margin:0;opacity:.6;font-size:.85em}' +
      '.cos-error{opacity:.8}'

    function apply(ctx) {
      // Call-time facade: an early render reports "initializing" and later
      // calls hit the mounted service without re-registering any UI.
      const api = {}
      for (const method of ['get', 'set']) {
        api[method] = (...args) => {
          const target = ctx.get('remote.' + SERVICE)
          if (!target || typeof target[method] !== 'function') {
            return Promise.resolve({ ok: false, error: { message: 'The output-styles service is still initializing. Try again in a moment.' } })
          }
          return target[method](...args)
        }
      }

      ctx.effect(async () => {
        const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE)
        return async () => { await disposeRemote() }
      }, `${PACKAGE}: remote bridge`)

      function OutputStyleSettings() {
        const [data, setData] = React.useState(null)
        const [error, setError] = React.useState(null)
        const [saved, setSaved] = React.useState(false)

        React.useEffect(() => {
          let alive = true
          api.get()
            .then((result) => { if (alive) setData(remoteValue(result)) })
            .catch((cause) => { if (alive) setError('Load failed: ' + String((cause && cause.message) || cause)) })
          return () => { alive = false }
        }, [])

        if (error !== null) {
          return h('div', { className: 'cos-page cos-error' }, h('style', null, PAGE_CSS), error)
        }
        if (data === null) {
          return h('div', { className: 'cos-page' }, h('style', null, PAGE_CSS), 'Loading…')
        }

        function persist(patch) {
          const mode = patch.mode !== undefined ? patch.mode : data.mode
          const custom = patch.custom !== undefined ? patch.custom : data.custom
          setData({ ...data, ...patch })
          setSaved(true)
          api.set(mode, custom)
            .then(remoteValue)
            .catch((cause) => setError('Save failed: ' + String((cause && cause.message) || cause)))
        }

        const children = [
          h('style', { key: 'css' }, PAGE_CSS),
          h(
            'p',
            { key: 'hint', className: 'cos-hint' },
            'Choose how the agent writes its responses. The style is injected into the system prompt ' +
              'on this deployment, applies from the next model step, and persists across restarts.'
          ),
        ]

        for (const preset of data.presets) {
          children.push(
            h(
              'label',
              { key: preset.id, className: 'cos-option' },
              h('input', {
                type: 'radio',
                name: 'cos-mode',
                checked: data.mode === preset.id,
                onChange: () => persist({ mode: preset.id }),
              }),
              h(
                'span',
                { className: 'cos-option-body' },
                h('span', { className: 'cos-option-label' }, preset.label),
                h('span', { className: 'cos-option-desc' }, preset.description)
              )
            )
          )
        }

        if (data.mode === 'custom') {
          children.push(
            h('textarea', {
              key: 'custom',
              className: 'cos-custom',
              rows: 7,
              value: data.custom,
              placeholder:
                'Example: Answer in short paragraphs. Always end with a one-line takeaway. Never use emojis.',
              onChange: (event) => setData({ ...data, custom: event.target.value }),
              onBlur: () => persist({}),
            })
          )
        }

        if (saved) {
          children.push(
            h('p', { key: 'saved', className: 'cos-saved' }, 'Saved — applies from the next model step.')
          )
        }

        return h('div', { className: 'cos-page' }, ...children)
      }

      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          { name: 'settings.section', id: 'output-styles', order: 25, label: 'Output Style' },
          () => h(OutputStyleSettings)
        )
      )
    }

    module.exports.apply = apply
    module.exports.inject = inject
    return module.exports
  },
})
