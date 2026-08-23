// Output Style — Client half (plain JavaScript, dynamic Cordis Plugin).
//
// Registers an "Output Style" page in the web settings panel (`settings.section`
// Slot). The page selects one of the built-in styles or a custom instruction,
// and persists the choice through the Package-private Host RPC. State is
// transient; it lives for the lifetime of the Plugin's Host run.

const h = React.createElement;

function OutputStyleSettings() {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    host
      .call('output-style/get')
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((cause) => {
        if (alive) setError('Load failed: ' + String(cause));
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error !== null) {
    return h('div', { className: 'cos-page cos-error' }, error);
  }
  if (data === null) {
    return h('div', { className: 'cos-page' }, 'Loading…');
  }

  function persist(patch) {
    const next = { mode: data.mode, custom: data.custom };
    for (const key in patch) next[key] = patch[key];
    setData({ ...data, ...next });
    setSaved(true);
    host.call('output-style/set', { mode: next.mode, custom: next.custom }).catch((cause) => {
      setError('Save failed: ' + String(cause));
    });
  }

  const children = [
    h(
      'p',
      { key: 'hint', className: 'cos-hint' },
      'Choose how the agent writes its responses. The style is injected into the system prompt ' +
        'and applies from the next model step. It is active while this plugin runs and resets ' +
        'when the harness restarts.'
    ),
  ];

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
    );
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
    );
  }

  if (saved) {
    children.push(
      h('p', { key: 'saved', className: 'cos-saved' }, 'Saved — applies from the next model step.')
    );
  }

  return h('div', { className: 'cos-page' }, ...children);
}

return {
  apply(ctx) {
    styles.insert(
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
