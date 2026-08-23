// Output Style — Client half (plain JavaScript, dynamic Cordis Plugin).
// The named style catalog is process-local in this session-only plugin form.

const h = React.createElement;

function OutputStyleSettings() {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [status, setStatus] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [editId, setEditId] = React.useState('');
  const [draftName, setDraftName] = React.useState('');
  const [draftInstructions, setDraftInstructions] = React.useState('');

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
  }

  function edit(style) {
    setEditId(style.id);
    setDraftName(style.name);
    setDraftInstructions(style.instructions);
  }

  function saveDraft(event) {
    event.preventDefault();
    run(
      'output-style/save',
      { styleId: editId, name: draftName, instructions: draftInstructions },
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
  );

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
        '.cos-field{display:flex;flex-direction:column;gap:4px;font-size:.9em}' +
        '.cos-input{font:inherit;padding:8px 10px;border-radius:6px;border:1px solid rgba(128,128,128,.3);' +
        'background:transparent;color:inherit}' +
        '.cos-instructions{resize:vertical}' +
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
