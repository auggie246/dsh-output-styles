# dsh-output-styles

A dynamic [Cordis](https://deepseek-ai.github.io/dsh/) plugin for the DeepSeek
Harness (DSH) that tweaks the agent's **output style** — inspired by Claude
Code's `/output-style` — and is configurable through the DSH web **Settings**
panel.

## How it works

- **Host half** (`plugin/host.js`) registers a `systemPrompt` section named
  `output-style` (order 5, right after the persona). Its text is a provider
  evaluated at *every* prompt assembly, so style changes apply from the next
  model step without a restart. Current state is exposed to the browser through
  a Package-private JSON RPC (`harness.handle` → `host.call`).
- **Client half** (`plugin/client.js`) registers an "Output Style" page in the
  `settings.section` Slot of the web GUI with a radio list of the built-in
  styles and a textarea for the custom style.

State is transient by design (dynamic plugins are process-local): it is held in
Host memory for the lifetime of the plugin run and resets on harness restart.

## Built-in styles

| Style       | Effect                                                          |
| ----------- | --------------------------------------------------------------- |
| Default     | No style instructions added.                                    |
| Concise     | Short, telegraphic answers; result first; no recaps.            |
| Explanatory | Adds reasoning, rejected alternatives, and tradeoffs.           |
| Learning    | Teaches while working; best practices and pitfalls.             |
| Formal      | Documentation tone: headings, precise terms, numbered steps.    |
| Custom      | Your own free-form style instructions.                          |

## Running it

The plugin is defined and activated through the DSH agent itself
(`cordis_define` + `cordis_run`); the source files in `plugin/` are the
canonical record of the two halves. Ask the agent in a DSH session:

> Define and run the output-style plugin from `plugin/host.js` and
> `plugin/client.js`.

Then open **Settings → Output Style** in the web GUI and pick a style.
