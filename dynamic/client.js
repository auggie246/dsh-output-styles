// Output Style — Client half (plain JavaScript, dynamic Cordis Plugin).
// The named style catalog is process-local in this session-only plugin form.

const h = React.createElement;

// BEGIN frontmatter parser (keep in sync across lib/catalog.js, lib/client.js, dynamic/host.js, dynamic/client.js)
function stripMatchingQuotes(value) {
  if (value.length >= 2) {
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) return value.slice(1, -1)
  }
  return value
}

// Minimal frontmatter reader for pasted style files (Claude Code output
// styles, Agent Skills SKILL.md). Supports flat "key: value" lines with
// optional matching quotes. Indented lines inside the block (nested YAML
// mappings such as `metadata:`) are skipped as ignored content.
function parseStyleFrontmatter(text) {
  const raw = typeof text === 'string' ? text : ''
  const failure = (error) => ({ hasFrontmatter: true, body: raw, name: null, description: null, ignoredKeys: [], error })
  const lines = raw.split('\n')
  let start = 0
  while (start < lines.length && lines[start].trim() === '') start += 1
  if (lines[start] !== '---') {
    return { hasFrontmatter: false, body: raw, name: null, description: null, ignoredKeys: [], error: null }
  }
  const fields = new Map()
  let index = start + 1
  let closed = false
  while (index < lines.length) {
    const line = lines[index]
    if (line === '---' || line === '...') {
      closed = true
      index += 1
      break
    }
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      index += 1
      continue
    }
    if (/^\s/.test(line)) {
      index += 1
      continue
    }
    const colon = line.indexOf(':')
    if (colon === -1) return failure('expected "key: value": "' + trimmed + '"')
    const key = line.slice(0, colon).trim()
    if (key === '') return failure('empty frontmatter key: "' + trimmed + '"')
    fields.set(key, stripMatchingQuotes(line.slice(colon + 1).trim()))
    index += 1
  }
  if (!closed) return failure('the frontmatter block is never closed with a "---" line')
  const body = lines.slice(index).join('\n').replace(/^\n+/, '')
  const name = fields.get('name') || null
  const description = fields.get('description') || null
  const ignoredKeys = []
  for (const key of fields.keys()) {
    if (key !== 'name' && key !== 'description') ignoredKeys.push(key)
  }
  return { hasFrontmatter: true, body, name, description, ignoredKeys, error: null }
}
// END frontmatter parser

// Example shown in the empty Instructions field: a whole style file with
// frontmatter. Typing or pasting text like this extracts name and
// description into their fields and keeps only the body.
const INSTRUCTIONS_PLACEHOLDER = [
  '---',
  'name: Wait What',
  'description: Re-pitches every answer with context, in plain words.',
  '---',
  '',
  'Open every answer with one line of context.',
  'Keep sentences short. Use the vocabulary the project already has.',
].join('\n');

function OutputStyleSettings() {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [status, setStatus] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [editId, setEditId] = React.useState('');
  const [draftName, setDraftName] = React.useState('');
  const [draftInstructions, setDraftInstructions] = React.useState('');
  const [draftDescription, setDraftDescription] = React.useState('');
  const [notice, setNotice] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    host.call('output-style/get')
      .then((result) => { if (alive) setData(result); })
      .catch((cause) => { if (alive) setError('Load failed: ' + String(cause)); });
    return () => { alive = false; };
  }, []);

  function run(method, args, message) {
    setSaving(true);
    setError(null);
    setStatus('');
    return host.call(method, args)
      .then((result) => {
        setData(result);
        setStatus(message);
        return result;
      })
      .catch((cause) => {
        setError('Action failed: ' + String(cause));
        return null;
      })
      .finally(() => setSaving(false));
  }

  function resetDraft() {
    setEditId('');
    setDraftName('');
    setDraftInstructions('');
    setDraftDescription('');
    setNotice(null);
  }

  function edit(style) {
    setEditId(style.id);
    setDraftName(style.name);
    setDraftInstructions(style.instructions);
    setDraftDescription(style.description || '');
    setNotice(null);
  }

  function describeFrontmatter(parsed, currentName) {
    if (parsed.error !== null) {
      return { tone: 'error', text: 'Frontmatter problem: ' + parsed.error };
    }
    const parts = ['Frontmatter applied: the body became the instructions.'];
    const typedName = currentName.trim();
    if (parsed.name !== null && parsed.name !== typedName) {
      parts.push(
        typedName === ''
          ? 'Name set to "' + parsed.name + '".'
          : 'The name field kept "' + typedName + '"; the frontmatter name "' + parsed.name + '" was not applied.'
      );
    }
    if (parsed.description !== null) parts.push('Description extracted.');
    if (parsed.ignoredKeys.length > 0) {
      parts.push(
        'Ignored keys (no effect here): ' + parsed.ignoredKeys.join(', ') +
          '. This plugin always keeps the coding instructions.'
      );
    }
    return { tone: 'info', text: parts.join(' ') };
  }

  function onInstructionsChange(value) {
    setDraftInstructions(value);
    const parsed = parseStyleFrontmatter(value);
    if (!parsed.hasFrontmatter) {
      setNotice(null);
      return;
    }
    if (parsed.error === null) {
      if (parsed.name !== null && draftName.trim() === '') setDraftName(parsed.name.slice(0, 80));
      if (parsed.description !== null) setDraftDescription(parsed.description.slice(0, 1024));
      setDraftInstructions(parsed.body);
    }
    setNotice(describeFrontmatter(parsed, draftName));
  }

  // The three draft fields, shared by the create form and the inline
  // edit form. Only one of them is on screen at a time.
  function draftFields() {
    return [
      h(
        'label',
        { key: 'draft-name', className: 'cos-field' },
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
        { key: 'draft-description', className: 'cos-field' },
        'Description (optional)',
        h('input', {
          className: 'cos-input',
          value: draftDescription,
          maxLength: 1024,
          disabled: saving,
          placeholder: 'Shown under the style name. A pasted frontmatter description fills this.',
          onChange: (event) => setDraftDescription(event.target.value),
        })
      ),
      h(
        'label',
        { key: 'draft-instructions', className: 'cos-field' },
        'Instructions (Markdown)',
        h('textarea', {
          className: 'cos-input cos-instructions',
          rows: 7,
          value: draftInstructions,
          maxLength: 4000,
          required: true,
          disabled: saving,
          placeholder: INSTRUCTIONS_PLACEHOLDER,
          onChange: (event) => onInstructionsChange(event.target.value),
        }),
        h(
          'span',
          { className: 'cos-field-hint' },
          'Write Markdown. Paste a whole style file; its frontmatter fills Name and Description.'
        )
      ),
    ];
  }

  function noticeElement() {
    if (notice === null) return null;
    return h(
      'p',
      { key: 'frontmatter-notice', className: notice.tone === 'error' ? 'cos-status cos-error' : 'cos-status' },
      notice.text
    );
  }

  function saveDraft(event) {
    event.preventDefault();
    run(
      'output-style/save',
      { styleId: editId, name: draftName, instructions: draftInstructions, description: draftDescription },
      editId === '' ? 'Output style created and selected.' : 'Output style updated and selected.'
    ).then((result) => { if (result !== null) resetDraft(); });
  }

  if (data === null) {
    return h('div', { className: 'cos-page' }, error || 'Loading…');
  }

  const children = [
    h(
      'p',
      { key: 'hint', className: 'cos-hint' },
      'Choose how the agent writes its responses. This session-only catalog resets when DSH restarts.'
    ),
    h('h3', { key: 'built-in-heading', className: 'cos-heading' }, 'Built-in styles'),
  ];

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
            onChange: () => run(
              'output-style/select',
              { styleId: preset.id },
              'Style selected. Applies from the next model step.'
            ),
          }),
          h(
            'span',
            { className: 'cos-option-body' },
            h('span', { className: 'cos-option-label' }, preset.label),
            h('span', { className: 'cos-option-desc' }, preset.description)
          )
        )
      )
    );
  }

  children.push(h('h3', { key: 'user-heading', className: 'cos-heading' }, 'Your styles'));
  if (data.userStyles.length === 0) {
    children.push(h('p', { key: 'empty', className: 'cos-hint' }, 'You have not created an output style yet.'));
  }

  for (const style of data.userStyles) {
    if (editId === style.id) {
      // The style's own row turns into the edit form. The create form
      // below is hidden while an edit is open.
      children.push(
        h(
          'form',
          { key: style.id, className: 'cos-form cos-editing', onSubmit: saveDraft },
          ...draftFields(),
          noticeElement(),
          h(
            'div',
            { className: 'cos-form-actions' },
            h('button', { type: 'button', className: 'cos-button', disabled: saving, onClick: resetDraft }, 'Cancel'),
            h(
              'button',
              { type: 'submit', className: 'cos-button', disabled: saving },
              saving ? 'Saving…' : 'Save style'
            )
          )
        )
      );
      continue;
    }
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
            onChange: () => run(
              'output-style/select',
              { styleId: style.id },
              'Style selected. Applies from the next model step.'
            ),
          }),
          h(
            'span',
            { className: 'cos-option-body' },
            h('span', { className: 'cos-option-label' }, style.name),
            h('span', { className: 'cos-option-desc' }, style.description || style.instructions)
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
                if (!window.confirm('Delete the output style "' + style.name + '"?')) return;
                run('output-style/remove', { styleId: style.id }, 'Output style deleted.').then((result) => {
                  if (result !== null && editId === style.id) resetDraft();
                });
              },
            },
            'Delete'
          )
        )
      )
    );
  }

  if (editId === '') {
    children.push(
      h(
        'form',
        { key: 'form', className: 'cos-form', onSubmit: saveDraft },
        h('strong', null, 'Create output style'),
        ...draftFields(),
        noticeElement(),
        h(
          'div',
          { className: 'cos-form-actions' },
          h(
            'button',
            { type: 'submit', className: 'cos-button', disabled: saving },
            saving ? 'Saving…' : 'Create style'
          )
        )
      )
    );
  }

  if (error !== null) children.push(h('p', { key: 'error', className: 'cos-status cos-error' }, error));
  else if (status !== '') children.push(h('p', { key: 'status', className: 'cos-status' }, status));

  return h('div', { className: 'cos-page' }, ...children);
}

return {
  apply(ctx) {
    styles.insert(
      '.cos-page{display:flex;flex-direction:column;gap:12px;max-width:42rem;padding:4px 0}' +
        '.cos-hint{margin:0;opacity:.75;line-height:1.5}' +
        '.cos-heading{font-size:1rem;margin:10px 0 0}' +
        '.cos-option{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;' +
        'border:1px solid rgba(128,128,128,.3);border-radius:8px}' +
        '.cos-choice{display:flex;gap:10px;align-items:flex-start;cursor:pointer;flex:1;min-width:0}' +
        '.cos-choice input{margin-top:3px}' +
        '.cos-option-body{display:flex;flex-direction:column;gap:2px;min-width:0}' +
        '.cos-option-label{font-weight:600}' +
        '.cos-option-desc{opacity:.7;font-size:.9em;line-height:1.4;white-space:pre-wrap}' +
        '.cos-actions{display:flex;gap:6px}' +
        '.cos-form{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:8px;' +
        'border:1px solid rgba(128,128,128,.3)}' +
        '.cos-editing{border-color:rgba(128,128,128,.6);background:rgba(128,128,128,.05)}' +
        '.cos-field{display:flex;flex-direction:column;gap:4px;font-size:.9em}' +
        '.cos-input{font:inherit;padding:8px 10px;border-radius:6px;border:1px solid rgba(128,128,128,.3);' +
        'background:transparent;color:inherit}' +
        '.cos-instructions{resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;' +
        'font-size:.95em;line-height:1.45}' +
        '.cos-field-hint{display:block;line-height:1.4;opacity:.7;font-size:.85em}' +
        '.cos-form-actions{display:flex;gap:8px;justify-content:flex-end}' +
        '.cos-button{font:inherit;padding:6px 10px;border-radius:6px;cursor:pointer;' +
        'border:1px solid rgba(128,128,128,.4);background:rgba(128,128,128,.1);color:inherit}' +
        '.cos-button:disabled{cursor:not-allowed;opacity:.5}' +
        '.cos-danger,.cos-error{color:#d66}' +
        '.cos-status{margin:0;opacity:.7;font-size:.85em}'
    );

    const slots = ctx.get('slots');
    if (slots === undefined) return;
    slots.inject('settings.section', () => {
      slots.register(
        { name: 'settings.section', id: 'output-style', order: 25, label: 'Output Style' },
        () => h(OutputStyleSettings)
      );
    });
  },
};
