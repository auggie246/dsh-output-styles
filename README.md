# @auggieteo/dsh-output-styles

Persistent **output styles for [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) Web** (`dsh web`): choose a built-in style or create, edit, and delete named styles from Settings.

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

## Requirements

- A [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) deployment (`@deepseek-ai/dsh` 0.1.0-rc.7 or compatible) with the **web profile** (`dsh web`).
- Node.js 20 or newer (the `prepare` build on git installs needs it).
- All runtime dependencies are peers provided by DSH; nothing else is installed.

## Install — permanent plugin (recommended)

This is the standard out-of-tree DSH plugin path; it survives restarts.
Pick **one** source for the package:

### Option 1: from the npm registry

```sh
dsh plugin --profile web add @auggieteo/dsh-output-styles
```

### Option 2: from GitHub (git URL)

```sh
dsh plugin --profile web add github:auggie246/dsh-output-styles
```

**pnpm gotcha for git installs:** git-hosted packages build on install via
their `prepare` script, and pnpm blocks that script until you allowlist it.
If the command fails, pnpm prints the exact key it blocked. Add that key
under `allowBuilds` in your profile's `pnpm-workspace.yaml`
(`~/.dsh/profiles/web/pnpm-workspace.yaml`), then re-run the same command:

```yaml
# ~/.dsh/profiles/web/pnpm-workspace.yaml
allowBuilds:
  # use the exact key pnpm printed, e.g.:
  # github+auggie246/dsh-output-styles: true
```

The `prepare` script only regenerates `dynamic/dsh-output-styles.dynamic.json`
with Node itself; it downloads nothing.

### Option 3: from a local checkout

```sh
git clone https://github.com/auggie246/dsh-output-styles.git
dsh plugin --profile web add /path/to/dsh-output-styles
```

### Activate it

Append the composition row from [`cordis.patch.example.yml`](cordis.patch.example.yml) to your profile patch layer. The `name` must match the installed package name; the `id` is your local cordis service id:

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: output-styles
      name: '@auggieteo/dsh-output-styles'
```

**Restart `dsh web`**, open the Settings panel, and choose **Output Style**.

### Uninstall

Remove the `- insert:` block above from `cordis.patch.yml`, then:

```sh
dsh plugin --profile web remove @auggieteo/dsh-output-styles
```

Restart `dsh web`. The `output-styles` section in `~/.dsh/settings.yaml` is harmless data; delete it if you want it gone.

### Upgrading from the pre-rename `dsh-output-styles` package

The npm package was renamed to `@auggieteo/dsh-output-styles`. The cordis
plugin id (`output-styles`), the settings namespace, and stored styles are
unchanged, so no data moves. Update both places in lockstep, then restart:

1. In `~/.dsh/profiles/web/package.json`: rename the dependency to
   `"@auggieteo/dsh-output-styles": "<source>"` (keep your previous source,
   e.g. a `file:` path, and remove the old `dsh-output-styles` entry).
2. In `~/.dsh/profiles/web/cordis.patch.yml`: set the insert `name:` to
   `'@auggieteo/dsh-output-styles'`.
3. Run `pnpm install` in the profile directory to relink `node_modules`.

### Troubleshooting: "TYPERT manifest names package ..." crash at boot

If `dsh web` fails with

```
typert-loader: <installed-name> TYPERT manifest names package "@auggieteo/dsh-output-styles"
— the manifest must be owned by the package that exports it
```

the plugin is installed under a different dependency key than its npm name
(for example the pre-rename `dsh-output-styles` with a `file:`/`link:` path).
The typert-loader requires the manifest's `package` field to equal the
dependency key it was loaded under. Apply the three-step lockstep update
above: the dependency key in `package.json`, the insert `name:` in
`cordis.patch.yml`, and the npm package name must all be the same string.

## Install — session-only dynamic plugin (zero install)

No files touch your DSH deployment — an agent defines the plugin into the
running DSH process. It disappears when that process restarts, and the style
selection lives only in that process's memory. See
[`dynamic/README.md`](dynamic/README.md); the short version: give your DSH
agent this prompt —

> Read `dynamic/dsh-output-styles.dynamic.json` from this repo. Call `cordis_define` with a new plugin, using its `name` and `description`, and its `host` and `client` strings as `code.host` and `code.client`. Then `cordis_run` the returned package; I'll approve the activation.

When both forms are active at once (e.g. testing option B while the permanent
plugin is installed), both contribute their own prompt section — pick one form.

## Usage

Open **Settings → Output Style**. Choose a built-in style or create a named
style with a name, an optional description, and your own instructions. The
selected style enters every agent's system prompt from the next model step.
Permanent-plugin user styles remain available after `dsh web` restarts.

### Editing a style in place

**Edit** turns the style's own row into the edit form; no edit form opens
below the list. **Save style** or **Cancel** returns the row to its normal
display. The **Create output style** form hides while an edit is open and
comes back afterwards.

### Markdown instructions

The Instructions field takes Markdown and uses a monospace font. When the
field is empty, its placeholder shows a complete example: an output style
file with `---` frontmatter.

### Pasting style files with frontmatter

The Instructions field accepts a whole style file. When the pasted text starts
with a `---` frontmatter block (Claude Code output styles, Agent Skills
`SKILL.md`), the page extracts `name` and `description` into their fields and
stores only the body as instructions. Other frontmatter keys
(`keep-coding-instructions`, `disable-model-invocation`, `metadata`, …) are
reported as ignored: this plugin appends its section to the system prompt, so
the harness coding instructions are always kept and behavior flags have no
effect. Only flat `key: value` frontmatter is supported; nested mappings under
unknown keys are skipped.

## Built-in styles

| Style       | Effect                                                       |
| ----------- | ------------------------------------------------------------ |
| Default     | No style instructions added.                                 |
| Concise     | Short, telegraphic answers; result first; no recaps.         |
| Explanatory | Adds reasoning, rejected alternatives, and tradeoffs.        |
| Learning    | Teaches while working; best practices and pitfalls.          |
| Formal      | Documentation tone: headings, precise terms, numbered steps. |

## Development

```
lib/            composition package (the permanent install)
  index.js      host plugin: settings namespace + systemPrompt section + outputStyles remote
  catalog.js    built-in catalog + stored-state helpers + frontmatter parsing
  remote.js     Typert manifest + strict JSON codecs + gateway class
  client.js     browser half (window.__ModuleLoader__ wrapper)
dynamic/        session-only install form (agent-defined dynamic plugin)
  host.js, client.js, dsh-output-styles.dynamic.json (generated), README.md
scripts/        bundle-dynamic.mjs — regenerates the single-file bundle
cordis.patch.example.yml — the composition row to copy into a profile
```

Both distribution forms share catalog behavior; keep them in sync. After
editing `dynamic/host.js` or `dynamic/client.js`, run `npm run bundle:dynamic`
and commit the regenerated bundle. `npm run prepare` runs the same build
(pnpm runs it automatically on git-URL installs). `npm test` checks the
`lib/` files and runs the catalog tests.

The dynamic form keeps its catalog in memory. The permanent form persists its
catalog in the settings document. `lib/catalog.js` is the permanent form's
catalog source.

## Limitations

- Session-only installs (dynamic form) vanish on DSH restart by design, and
  their selection is not persisted.
- The style section is global to the deployment (permanent plugin): it shapes
  every agent on that `dsh web` instance, not per-session choices.

## License

[MIT](LICENSE)
