/* Persistent output-style settings page for DeepSeek Harness Web. */
window.__ModuleLoader__.load({
  id: '@auggieteo/dsh-output-styles',
  factory: (require) => {
    const module = { exports: {} }
    const React = require('react')
    const h = React.createElement
    const PACKAGE = '@auggieteo/dsh-output-styles'
    const SERVICE = 'outputStyles'

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
    const UserStyleCodec = codec(`${PACKAGE}/UserStyle`, (value) => {
      const v = record(value, 'user style')
      onlyKeys(v, ['id', 'name', 'instructions'], 'user style')
      return {
        id: string(v.id, 'userStyle.id'),
        name: string(v.name, 'userStyle.name'),
        instructions: string(v.instructions, 'userStyle.instructions'),
      }
    })
    const GetResultCodec = codec(`${PACKAGE}/GetResult`, (value) => {
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
    const TYPERT_REMOTE = Object.freeze({
      package: PACKAGE,
      descriptors: [
        invocation('get', [], result(GetResultCodec)),
        invocation('select', [param('styleId', StyleIdParam)], result(GetResultCodec)),
        invocation(
          'save',
          [param('styleId', StyleIdParam), param('name', NameParam), param('instructions', InstructionsParam)],
          result(GetResultCodec)
        ),
        invocation('deleteStyle', [param('styleId', StyleIdParam)], result(GetResultCodec)),
      ],
    })

    const inject = ['slots', 'remote']

    function remoteValue(result) {
      if (!result || !result.ok) {
        throw new Error((result && result.error && result.error.message) || 'The DSH server rejected this request.')
      }
      return result.value
    }

    const PAGE_CSS =
      '.cos-page{display:flex;flex-direction:column;gap:12px;max-width:42rem;padding:4px 0}' +
      '.cos-hint,.cos-empty{margin:0;opacity:.75;line-height:1.5}' +
      '.cos-heading{font-size:1rem;margin:10px 0 0}' +
      '.cos-option{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;' +
      'border:1px solid rgba(128,128,128,.3);border-radius:8px}' +
      '.cos-option:hover{background:rgba(128,128,128,.08)}' +
      '.cos-choice{display:flex;gap:10px;align-items:flex-start;cursor:pointer;flex:1;min-width:0}' +
      '.cos-choice input{margin-top:3px}' +
      '.cos-option-body{display:flex;flex-direction:column;gap:2px;min-width:0}' +
      '.cos-option-label{font-weight:600}' +
      '.cos-option-desc{opacity:.7;font-size:.9em;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}' +
      '.cos-actions{display:flex;gap:6px}' +
      '.cos-form{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:8px;' +
      'border:1px solid rgba(128,128,128,.3)}' +
      '.cos-field{display:flex;flex-direction:column;gap:4px;font-size:.9em}' +
      '.cos-input{font:inherit;padding:8px 10px;border-radius:6px;border:1px solid rgba(128,128,128,.3);' +
      'background:transparent;color:inherit}' +
      '.cos-instructions{resize:vertical}' +
      '.cos-form-actions{display:flex;gap:8px;justify-content:flex-end}' +
      '.cos-button{font:inherit;padding:6px 10px;border-radius:6px;cursor:pointer;' +
      'border:1px solid rgba(128,128,128,.4);background:rgba(128,128,128,.1);color:inherit}' +
      '.cos-button:disabled{cursor:not-allowed;opacity:.5}' +
      '.cos-danger{color:#d66}' +
      '.cos-status{margin:0;opacity:.7;font-size:.85em}' +
      '.cos-error{color:#d66}'

    function apply(ctx) {
      let resolveRemoteReady
      let rejectRemoteReady
      const remoteReady = new Promise((resolve, reject) => {
        resolveRemoteReady = resolve
        rejectRemoteReady = reject
      })
      void remoteReady.catch(() => {})

      const api = {}
      for (const method of ['get', 'select', 'save', 'deleteStyle']) {
        api[method] = (...args) => remoteReady.then(() => {
          const target = ctx.get('remote.' + SERVICE)
          if (!target || typeof target[method] !== 'function') {
            throw new Error(`The output-styles service mounted without the ${method} method.`)
          }
          return target[method](...args)
        })
      }

      ctx.effect(async () => {
        try {
          const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE)
          resolveRemoteReady()
          return async () => { await disposeRemote() }
        } catch (error) {
          rejectRemoteReady(error)
          throw error
        }
      }, `${PACKAGE}: remote bridge`)

      function OutputStyleSettings() {
        const [data, setData] = React.useState(null)
        const [loadError, setLoadError] = React.useState(null)
        const [actionError, setActionError] = React.useState(null)
        const [status, setStatus] = React.useState('')
        const [saving, setSaving] = React.useState(false)
        const [editId, setEditId] = React.useState('')
        const [draftName, setDraftName] = React.useState('')
        const [draftInstructions, setDraftInstructions] = React.useState('')

        React.useEffect(() => {
          let alive = true
          api.get()
            .then(remoteValue)
            .then((value) => { if (alive) setData(value) })
            .catch((cause) => {
              if (alive) setLoadError('Load failed: ' + String((cause && cause.message) || cause))
            })
          return () => { alive = false }
        }, [])

        function run(action, successMessage) {
          setSaving(true)
          setActionError(null)
          setStatus('')
          return action()
            .then(remoteValue)
            .then((value) => {
              setData(value)
              setStatus(successMessage)
              return value
            })
            .catch((cause) => {
              setActionError(String((cause && cause.message) || cause))
              return null
            })
            .finally(() => setSaving(false))
        }

        function resetDraft() {
          setEditId('')
          setDraftName('')
          setDraftInstructions('')
        }

        function edit(style) {
          setEditId(style.id)
          setDraftName(style.name)
          setDraftInstructions(style.instructions)
          setStatus('')
          setActionError(null)
        }

        function saveDraft(event) {
          event.preventDefault()
          run(
            () => api.save(editId, draftName, draftInstructions),
            editId === '' ? 'Output style created and selected.' : 'Output style updated and selected.'
          ).then((value) => { if (value !== null) resetDraft() })
        }

        if (loadError !== null) {
          return h('div', { className: 'cos-page cos-error' }, h('style', null, PAGE_CSS), loadError)
        }
        if (data === null) {
          return h('div', { className: 'cos-page' }, h('style', null, PAGE_CSS), 'Loading…')
        }

        const children = [
          h('style', { key: 'css' }, PAGE_CSS),
          h(
            'p',
            { key: 'hint', className: 'cos-hint' },
            'Choose how the agent writes its responses. User-created styles are stored in DSH settings ' +
              'and persist across restarts.'
          ),
          h('h3', { key: 'built-in-heading', className: 'cos-heading' }, 'Built-in styles'),
        ]

        for (const preset of data.presets) {
          children.push(
            h(
              'div',
              { key: preset.id, className: 'cos-option' },
              h(
                'label',
                { className: 'cos-choice' },
                h('input', {
                  type: 'radio',
                  name: 'cos-style',
                  checked: data.selectedId === preset.id,
                  disabled: saving,
                  onChange: () => run(() => api.select(preset.id), 'Style selected. Applies from the next model step.'),
                }),
                h(
                  'span',
                  { className: 'cos-option-body' },
                  h('span', { className: 'cos-option-label' }, preset.label),
                  h('span', { className: 'cos-option-desc' }, preset.description)
                )
              )
            )
          )
        }

        children.push(h('h3', { key: 'user-heading', className: 'cos-heading' }, 'Your styles'))
        if (data.userStyles.length === 0) {
          children.push(h('p', { key: 'empty', className: 'cos-empty' }, 'You have not created an output style yet.'))
        }

        for (const style of data.userStyles) {
          children.push(
            h(
              'div',
              { key: style.id, className: 'cos-option' },
              h(
                'label',
                { className: 'cos-choice' },
                h('input', {
                  type: 'radio',
                  name: 'cos-style',
                  checked: data.selectedId === style.id,
                  disabled: saving,
                  onChange: () => run(() => api.select(style.id), 'Style selected. Applies from the next model step.'),
                }),
                h(
                  'span',
                  { className: 'cos-option-body' },
                  h('span', { className: 'cos-option-label' }, style.name),
                  h('span', { className: 'cos-option-desc' }, style.instructions)
                )
              ),
              h(
                'span',
                { className: 'cos-actions' },
                h('button', { type: 'button', className: 'cos-button', disabled: saving, onClick: () => edit(style) }, 'Edit'),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'cos-button cos-danger',
                    disabled: saving,
                    onClick: () => {
                      if (!window.confirm(`Delete the output style "${style.name}"?`)) return
                      run(() => api.deleteStyle(style.id), 'Output style deleted.').then((value) => {
                        if (value !== null && editId === style.id) resetDraft()
                      })
                    },
                  },
                  'Delete'
                )
              )
            )
          )
        }

        children.push(
          h(
            'form',
            { key: 'form', className: 'cos-form', onSubmit: saveDraft },
            h('strong', null, editId === '' ? 'Create output style' : 'Edit output style'),
            h(
              'label',
              { className: 'cos-field' },
              'Name',
              h('input', {
                className: 'cos-input',
                value: draftName,
                maxLength: 80,
                required: true,
                disabled: saving,
                placeholder: 'Example: Wait What',
                onChange: (event) => setDraftName(event.target.value),
              })
            ),
            h(
              'label',
              { className: 'cos-field' },
              'Instructions',
              h('textarea', {
                className: 'cos-input cos-instructions',
                rows: 7,
                value: draftInstructions,
                maxLength: 4000,
                required: true,
                disabled: saving,
                placeholder: 'Describe the tone, structure, and level of detail for every response.',
                onChange: (event) => setDraftInstructions(event.target.value),
              })
            ),
            h(
              'div',
              { className: 'cos-form-actions' },
              editId === ''
                ? null
                : h('button', { type: 'button', className: 'cos-button', disabled: saving, onClick: resetDraft }, 'Cancel'),
              h(
                'button',
                { type: 'submit', className: 'cos-button', disabled: saving },
                saving ? 'Saving…' : editId === '' ? 'Create style' : 'Save style'
              )
            )
          )
        )

        if (actionError !== null) {
          children.push(h('p', { key: 'error', className: 'cos-status cos-error' }, 'Action failed: ' + actionError))
        } else if (status !== '') {
          children.push(h('p', { key: 'status', className: 'cos-status' }, status))
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
