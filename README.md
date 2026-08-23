# dsh-output-styles

Persistent **output styles for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web** (`dsh web`): choose a built-in style or create, edit, and delete named styles from Settings.

## How it works

- The host half registers a global `output-style` section in the harness
  `systemPrompt` registry (order 5, right after the persona). Its text is
  re-evaluated at **every prompt assembly**, so changing the style applies
  from the **next model step** — no new session, no restart.
- The selection and named user styles are stored in the harness settings
  document (`output-styles` namespace in `~/.dsh/settings.yaml`), so they
  **survive `dsh web` restarts**.
- The browser half adds an **Output Style** page to Settings. The page selects
  built-in styles and creates, edits, or deletes named user styles.

## Built-in styles

| Style       | Effect                                                       |
| ----------- | ------------------------------------------------------------ |
| Default     | No style instructions added.                                 |
| Concise     | Short, telegraphic answers; result first; no recaps.         |
| Explanatory | Adds reasoning, rejected alternatives, and tradeoffs.        |
| Learning    | Teaches while working; best practices and pitfalls.          |
| Formal      | Documentation tone: headings, precise terms, numbered steps. |

## Requirements

- A [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) deployment (`@deepseek-ai/dsh` 0.1.0-rc.7 or compatible) with the **web profile** (`dsh web`).

## Install — option A: permanent plugin (recommended)

This is the standard out-of-tree DSH plugin path; it survives restarts.

```sh
# 1. Get the package
git clone https://github.com/YOUR-USER/dsh-output-styles.git
cd dsh-output-styles

# 2. Install it into the web profile (pnpm add under the hood)
dsh plugin --profile web add /path/to/dsh-output-styles
```

3. Append the composition row from [`cordis.patch.example.yml`](cordis.patch.example.yml) to your profile patch layer:

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: output-styles
      name: 'dsh-output-styles'
```

4. **Restart `dsh web`**, open the Settings panel, and choose **Output Style**.

### Uninstall

Remove the `- insert:` block above from `cordis.patch.yml`, then:

```sh
dsh plugin --profile web remove dsh-output-styles
```

Restart `dsh web`. The `output-styles` section in `~/.dsh/settings.yaml` is harmless data; delete it if you want it gone.

## Install — option B: session-only dynamic plugin (zero install)

No files touch your DSH deployment — an agent defines the plugin into the
running DSH process. It disappears when that process restarts, and the style
selection lives only in that process's memory. See
[`dynamic/README.md`](dynamic/README.md); the short version: give your DSH
agent this prompt —

> Read `dynamic/dsh-output-styles.dynamic.json` from this repo. Call `cordis_define` with a new plugin, using its `name` and `description`, and its `host` and `client` strings as `code.host` and `code.client`. Then `cordis_run` the returned package; I'll approve the activation.

When both forms are active at once (e.g. testing option B while option A is
installed), both contribute their own prompt section — pick one form.

## Usage

Open **Settings → Output Style**. Choose a built-in style or create a named
style with your own instructions. The selected style enters every agent's
system prompt from the next model step. Permanent-plugin user styles remain
available after `dsh web` restarts.

## Development

```
lib/            composition package (the permanent install)
  index.js      host plugin: settings namespace + systemPrompt section + outputStyles remote
  catalog.js    built-in catalog + stored-state helpers
  remote.js     Typert manifest + strict JSON codecs + gateway class
  client.js     browser half (window.__ModuleLoader__ wrapper)
dynamic/        session-only install form (agent-defined dynamic plugin)
  host.js, client.js, dsh-output-styles.dynamic.json (generated), README.md
scripts/        bundle-dynamic.mjs — regenerates the single-file bundle
cordis.patch.example.yml — the composition row to copy into a profile
```

Both distribution forms share catalog behavior; keep them in sync. After
editing `dynamic/host.js` or `dynamic/client.js`, run `npm run bundle:dynamic`
and commit the regenerated bundle. The dynamic form keeps its catalog in
memory. The permanent form persists its catalog in the settings document.
`lib/catalog.js` is the permanent form's catalog source. `npm test` checks the
`lib/` files and runs the catalog tests.

## Limitations

- Session-only installs (option B) vanish on DSH restart by design, and their
  selection is not persisted.
- The style section is global to the deployment (option A): it shapes every
  agent on that `dsh web` instance, not per-session choices.

## License

[MIT](LICENSE)
