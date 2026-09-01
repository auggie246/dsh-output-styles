// Output Style — Host half (plain JavaScript, dynamic Cordis Plugin).
//
// This dynamic form supports the same named style catalog as the permanent
// plugin. Its catalog remains process-local because dynamic plugins do not own
// a durable settings namespace.

const PRESETS = [
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
];

const MAX_USER_STYLES = 50;
const MAX_STYLE_NAME_LENGTH = 80;
const MAX_STYLE_INSTRUCTIONS_LENGTH = 4000;
const MAX_STYLE_DESCRIPTION_LENGTH = 1024;

// The two marked blocks below are byte-identical copies of lib/catalog.js
// logic (this file cannot import it). A unit test compares all copies, so
// edit them together. They are semicolon-free on purpose; keep them so.

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

// BEGIN style draft resolver (keep in sync across lib/catalog.js and dynamic/host.js)
// Applies pasted frontmatter to a save draft. Explicit arguments win; the
// frontmatter fills the gaps. Throws plain errors for the caller to prefix.
function resolveStyleDraft(name, instructions, description) {
  const parsed = parseStyleFrontmatter(typeof instructions === 'string' ? instructions : '')
  if (parsed.error !== null) throw new Error(parsed.error)
  const typedName = typeof name === 'string' ? name.trim() : ''
  const typedDescription = typeof description === 'string' ? description.trim() : ''
  const resolvedName = typedName !== '' ? typedName : parsed.name !== null ? parsed.name : ''
  const resolvedInstructions = parsed.hasFrontmatter ? parsed.body : typeof instructions === 'string' ? instructions : ''
  const resolvedDescription = typedDescription !== '' ? typedDescription : parsed.description !== null ? parsed.description : ''
  if (resolvedName === '') throw new Error('style name is required')
  if (resolvedName.length > MAX_STYLE_NAME_LENGTH) throw new Error('style name exceeds ' + MAX_STYLE_NAME_LENGTH + ' characters')
  if (resolvedInstructions.trim() === '') throw new Error('style instructions are required')
  if (resolvedInstructions.length > MAX_STYLE_INSTRUCTIONS_LENGTH) {
    throw new Error('style instructions exceed ' + MAX_STYLE_INSTRUCTIONS_LENGTH + ' characters')
  }
  if (resolvedDescription.length > MAX_STYLE_DESCRIPTION_LENGTH) {
    throw new Error('style description exceeds ' + MAX_STYLE_DESCRIPTION_LENGTH + ' characters')
  }
  return { name: resolvedName, instructions: resolvedInstructions, description: resolvedDescription }
}
// END style draft resolver

return {
  apply(ctx) {
    const state = { selectedId: 'default', userStyles: [] };
    const presetIds = {};
    for (const preset of PRESETS) presetIds[preset.id] = true;

    function isKnownStyle(styleId) {
      if (presetIds[styleId] === true) return true;
      return state.userStyles.some((style) => style.id === styleId);
    }

    function currentStyleText() {
      for (const preset of PRESETS) {
        if (preset.id === state.selectedId) return preset.prompt;
      }
      const style = state.userStyles.find((entry) => entry.id === state.selectedId);
      return style ? style.instructions.trim() : '';
    }

    function result() {
      return {
        selectedId: state.selectedId,
        userStyles: state.userStyles.map((style) => ({ ...style })),
        presets: PRESETS.map((preset) => ({
          id: preset.id,
          label: preset.label,
          description: preset.description,
        })),
      };
    }

    const systemPrompt = ctx.get('systemPrompt');
    if (systemPrompt !== undefined) {
      systemPrompt.section({
        name: 'output-style',
        order: 5,
        text: () => {
          const body = currentStyleText();
          if (body === '') return '';
          return (
            '## Output Style\n\n' +
            'The user has configured the following output style. Adapt the tone, structure, ' +
            'and level of detail of every natural-language response to match it:\n\n' +
            body
          );
        },
      });
    } else {
      console.error('systemPrompt service is unavailable; output style will not apply.');
    }

    harness.handle('output-style/get', () => result());

    harness.handle('output-style/select', (args) => {
      if (!args || !isKnownStyle(args.styleId)) throw new Error('unknown style: ' + String(args && args.styleId));
      state.selectedId = args.styleId;
      return result();
    });

    harness.handle('output-style/save', (args) => {
      if (!args || typeof args !== 'object') throw new Error('invalid arguments');
      const value = resolveStyleDraft(args.name, args.instructions, args.description);
      let styleId = typeof args.styleId === 'string' ? args.styleId : '';
      if (styleId === '') {
        if (state.userStyles.length >= MAX_USER_STYLES) throw new Error('too many user styles');
        styleId = 'user:' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        state.userStyles.push({ id: styleId, ...value });
      } else {
        const index = state.userStyles.findIndex((style) => style.id === styleId);
        if (index === -1) throw new Error('unknown user style: ' + styleId);
        state.userStyles[index] = { id: styleId, ...value };
      }
      state.selectedId = styleId;
      return result();
    });

    harness.handle('output-style/remove', (args) => {
      const styleId = args && args.styleId;
      const index = state.userStyles.findIndex((style) => style.id === styleId);
      if (index === -1) throw new Error('unknown user style: ' + String(styleId));
      state.userStyles.splice(index, 1);
      if (state.selectedId === styleId) state.selectedId = 'default';
      return result();
    });
  },
};
