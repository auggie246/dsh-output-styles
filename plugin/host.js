// Output Style — Host half (plain JavaScript, dynamic Cordis Plugin).
//
// Registers a configurable "output style" section in the system prompt. The
// section text is a provider evaluated at EVERY prompt assembly, so changing
// the style in the web settings UI applies from the next model step — no
// restart required. Exposes a Package-private JSON API to the Client half
// (harness.handle / host.call).

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
  {
    id: 'custom',
    label: 'Custom',
    description: 'Write your own style instructions below.',
    prompt: '',
  },
];

const MAX_CUSTOM_LENGTH = 4000;

return {
  apply(ctx) {
    const state = {
      mode: 'default',
      custom: '',
    };
    const presetIds = {};
    for (const preset of PRESETS) presetIds[preset.id] = true;

    function currentStyleText() {
      if (state.mode === 'custom') return state.custom.trim();
      for (const preset of PRESETS) {
        if (preset.id === state.mode) return preset.prompt;
      }
      return '';
    }

    // The system-prompt contribution. `text` is re-evaluated at each assembly,
    // which happens before every model step, so live settings take effect on
    // the next step. An empty text renders nothing ("default" contributes no
    // instructions). Order 5 places the style right after the persona (0)
    // and before tool guidance (100–199).
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

    // Package-private JSON API for the Client settings page.
    harness.handle('output-style/get', () => {
      return {
        mode: state.mode,
        custom: state.custom,
        presets: PRESETS.map((preset) => ({
          id: preset.id,
          label: preset.label,
          description: preset.description,
        })),
      };
    });

    harness.handle('output-style/set', (args) => {
      if (args === null || typeof args !== 'object') {
        return { ok: false, error: 'invalid arguments' };
      }
      const mode = args.mode;
      if (typeof mode !== 'string' || presetIds[mode] !== true) {
        return { ok: false, error: 'unknown mode: ' + String(mode) };
      }
      state.mode = mode;
      if (typeof args.custom === 'string') {
        state.custom = args.custom.slice(0, MAX_CUSTOM_LENGTH);
      }
      console.log('output style set to ' + state.mode);
      return { ok: true, mode: state.mode };
    });
  },
};
