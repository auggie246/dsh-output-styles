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

    function draft(args) {
      const name = typeof args.name === 'string' ? args.name.trim() : '';
      const instructions = typeof args.instructions === 'string' ? args.instructions : '';
      if (name === '') throw new Error('style name is required');
      if (name.length > MAX_STYLE_NAME_LENGTH) throw new Error('style name is too long');
      if (instructions.trim() === '') throw new Error('style instructions are required');
      if (instructions.length > MAX_STYLE_INSTRUCTIONS_LENGTH) throw new Error('style instructions are too long');
      return { name, instructions };
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
      const value = draft(args);
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
