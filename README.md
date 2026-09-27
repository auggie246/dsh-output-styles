# dsh-output-styles _(@auggieteo/dsh-output-styles)_

[![npm version](https://img.shields.io/npm/v/@auggieteo%2Fdsh-output-styles.svg)](https://www.npmjs.com/package/@auggieteo/dsh-output-styles)
[![License: MIT](https://img.shields.io/npm/l/@auggieteo%2Fdsh-output-styles.svg)](LICENSE)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg)](https://github.com/RichardLitt/standard-readme)

Persistent output styles for DeepSeek Harness Web: pick a built-in style or create named styles from the Settings page

The plugin adds an **Output Style** page to the `dsh web` Settings dialog. Pick a built-in style, or create named styles with Markdown instructions. The selected style enters every agent's system prompt from the next model step — no restart needed. User styles persist across restarts in the `output-styles` entry's `config` in the profile patch.

The package name is scoped on npm, `@auggieteo/dsh-output-styles`; the repository and folder are `dsh-output-styles`.

## Table of Contents

- [Install](#install)
  - [Dependencies](#dependencies)
  - [Manual wiring](#manual-wiring)
- [Usage](#usage)
  - [Pasting style files](#pasting-style-files)
  - [Built-in styles](#built-in-styles)
  - [Session-only install](#session-only-install)
- [Compatibility](#compatibility)
- [Development](#development)
- [FAQ](#faq)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Install

```sh
dsh plugin --profile web add @auggieteo/dsh-output-styles
```

Restart `dsh web` and open **Settings → Output Style**. No manual wiring: the package ships a bundle patch, and `dsh plugin add` joins it to the profile's layer stack (`dsh.profile.bundles`) automatically. `dsh plugin --profile web remove` unwires it the same way.

Other sources:

```sh
dsh plugin --profile web add github:auggie246/dsh-output-styles   # from GitHub
dsh plugin --profile web add /path/to/dsh-output-styles           # from a local checkout
```

Git installs run a `prepare` build that pnpm blocks until allowlisted: add the exact key pnpm prints under `allowBuilds` in `~/.dsh/profiles/web/pnpm-workspace.yaml`, then re-run the same command.

### Dependencies

- Node.js 20+.
- `@deepseek-ai/dsh` with the web profile; tested against 0.1.7-rc.2. See [Compatibility](#compatibility).
- All runtime dependencies are peers provided by DSH.

### Manual wiring

Only when managing dependencies by hand: append the composition row from [`cordis.patch.example.yml`](cordis.patch.example.yml) to `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: output-styles
      name: "@auggieteo/dsh-output-styles"
```

The `name` must match the installed package name; the `id` is your local cordis service id and doubles as the settings namespace holding your stored styles. Skip this row when the package is already listed under `dsh.profile.bundles` — the bundle patch supplies it.

## Usage

Open **Settings → Output Style**:

- Pick a built-in style, or create a named style with a name, an optional description, and Markdown instructions.
- **Edit** turns a style's own row into the edit form; **Save** or **Cancel** restores it. The create form hides while an edit is open.
- The selected style enters every agent's system prompt from the **next model step** — no restart needed.
- User styles persist across restarts in the `output-styles` entry's `config` in `~/.dsh/profiles/<profile>/cordis.patch.yml`. The entry is global to the profile, not per-session.

### Pasting style files

The Instructions field accepts a whole style file — Claude Code output styles and Agent Skills `SKILL.md`. Its frontmatter fills Name and Description; only the body is stored as instructions. The empty field shows a complete example.

Other frontmatter keys (`keep-coding-instructions`, `disable-model-invocation`, `metadata`, …) are reported as ignored: the plugin appends its section to the system prompt, so the harness coding instructions are always kept and behavior flags have no effect. Only flat `key: value` frontmatter is supported.

### Built-in styles

| Style       | Effect                                                       |
| ----------- | ------------------------------------------------------------ |
| Default     | No style instructions added.                                 |
| Concise     | Short, telegraphic answers; result first; no recaps.         |
| Explanatory | Adds reasoning, rejected alternatives, and tradeoffs.        |
| Learning    | Teaches while working; best practices and pitfalls.          |
| Formal      | Documentation tone: headings, precise terms, numbered steps. |

### Session-only install

An agent can define the plugin into a running DSH process — no files touch the deployment, and it disappears when that process restarts. Paste this into a DSH session whose agent has the Cordis tools:

> Read `dynamic/dsh-output-styles.dynamic.json`. Call `cordis_define` with a
> new plugin, using its `name` and `description`, and its `host` and `client`
> strings as `code.host` and `code.client`. Then `cordis_run` the returned
> package. I'll approve the activation.

If both forms are active at once, both contribute their own prompt section; pick one form. See [`dynamic/README.md`](dynamic/README.md).

## Compatibility

Tested against `@deepseek-ai/dsh` 0.1.7-rc.2 (web profile). This is the only supported line: **0.1.1-rc.2, 0.1.2-rc.1, and 0.1.5-rc.x were dropped in 0.6.0.**

0.1.7 replaced two surfaces this plugin depends on, so the older lines cannot be supported side by side:

- **Typert codecs.** A strict codec must now carry a `create()` factory returning the process-local schema; 0.1.5 instead required an `_zod`-backed `schema` property. The plugin's codecs carry `create()` only.
- **Editable settings.** `ctx.settings.register(ns, schema, …)` is gone. Editable configuration is now declared as `schemastery` `.volatile()` fields on the plugin's own exported `Config` and written with `ctx.settings.update(<profile entry id>, patch)`. `.volatile()` first appears in `@deepseek-ai/schemastery` 3.18.3 (0.1.7 ships 3.18.4) and does **not** exist in the schemastery the 0.1.5 harness ships, so the two models are mutually exclusive.

Because the plugin's Config fields are volatile, a write updates them in place: the Loader commits a volatile-only config change into the running plugin's references without remounting it, and the prompt section re-reads the live value on the next assembly. Changes therefore still take effect from the next model step with no restart.

The system-prompt placement is unchanged: the `output-style` section still sits at order 5, right after the persona prefix.

The client manifest lists a single bootstrap under `dsh.client.inject`: `@deepseek-ai/dsh-client-web`. `@deepseek-ai/dsh-client-runtime` (the 0.1.1-rc.x bootstrap) is no longer published and was removed.

## Development

```
lib/        permanent form: host plugin, catalog, typert codecs, Settings page
dynamic/    session-only form (host.js, client.js, generated bundle)
scripts/    bundle-dynamic.mjs — regenerates the single-file bundle
test/       catalog, client mount, identity, parser sync
```

After editing `dynamic/host.js` or `dynamic/client.js`, run `npm run bundle:dynamic` and commit the regenerated bundle. `npm test` runs the syntax checks and the test suite.

The frontmatter parser and the style draft resolver exist as byte-identical marked blocks in `lib/catalog.js`, `lib/client.js`, `dynamic/host.js`, and `dynamic/client.js`; a sync test fails when a copy drifts. The host registers the selected style's text as a `systemPrompt` section at order 5, right after the persona, re-evaluated at every prompt assembly.

## FAQ

**The Settings panel has no Output Style page.**
The plugin is not wired: re-run `dsh plugin --profile web add @auggieteo/dsh-output-styles` (it joins `dsh.profile.bundles` automatically) and restart `dsh web`. If you manage the dependency by hand, check the manual wiring row instead.

**`dsh web` crashes at boot with `TYPERT manifest names package ...`.**
The plugin is installed under a different dependency key than its npm name (for example, the pre-rename `dsh-output-styles` with a `file:`/`link:` path). The dependency key in `~/.dsh/profiles/web/package.json`, the insert `name:` in `cordis.patch.yml`, and the package name must all be the same string, `@auggieteo/dsh-output-styles`. Renaming does not move data: the cordis plugin id (`output-styles`), the settings namespace, and stored styles are unchanged.

## Maintainers

- [auggieteo](https://github.com/auggie246)

## Contributing

PRs are welcome. Ask questions or report problems in the [issue tracker](https://github.com/auggie246/dsh-output-styles/issues); for anything larger than a fix, open an issue first.

- Run `npm test` before you send a PR.
- Keep the marked blocks in `lib/catalog.js`, `lib/client.js`, `dynamic/host.js`, and `dynamic/client.js` byte-identical; the sync test fails otherwise.
- If you changed `dynamic/`, regenerate the bundle with `npm run bundle:dynamic`.

## License

MIT © dsh-output-styles contributors — see [LICENSE](LICENSE) for details.
