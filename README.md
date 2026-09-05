# dsh-output-styles _(@auggieteo/dsh-output-styles)_

[![npm version](https://img.shields.io/npm/v/@auggieteo%2Fdsh-output-styles.svg)](https://www.npmjs.com/package/@auggieteo/dsh-output-styles)
[![License: MIT](https://img.shields.io/npm/l/@auggieteo%2Fdsh-output-styles.svg)](LICENSE)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg)](https://github.com/RichardLitt/standard-readme)

Persistent output styles for DeepSeek Harness Web: pick a built-in style or create named styles from the Settings page

The plugin adds an **Output Style** page to the `dsh web` Settings dialog. Pick a built-in style, or create named styles with Markdown instructions. The selected style enters every agent's system prompt from the next model step — no restart needed. User styles persist across restarts in `~/.dsh/settings.yaml`, in the `output-styles` namespace.

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
- `@deepseek-ai/dsh` with the web profile; tested against 0.1.1-rc.2 and 0.1.2-rc.1. See [Compatibility](#compatibility).
- All runtime dependencies are peers provided by DSH.

### Manual wiring

Only when managing dependencies by hand: append the composition row from [`cordis.patch.example.yml`](cordis.patch.example.yml) to `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: output-styles
      name: "@auggieteo/dsh-output-styles"
```

The `name` must match the installed package name; the `id` is your local cordis service id. Skip this row when the package is already listed under `dsh.profile.bundles` — the bundle patch supplies it.

## Usage

Open **Settings → Output Style**:

- Pick a built-in style, or create a named style with a name, an optional description, and Markdown instructions.
- **Edit** turns a style's own row into the edit form; **Save** or **Cancel** restores it. The create form hides while an edit is open.
- The selected style enters every agent's system prompt from the **next model step** — no restart needed.
- User styles persist across restarts in `~/.dsh/settings.yaml` (the `output-styles` namespace). The style section is global to the deployment, not per-session.

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

Tested against `@deepseek-ai/dsh` 0.1.1-rc.2 and 0.1.2-rc.1 (web profile). The 0.1.2 audit found no breaking API change for this plugin: `settings.register/get/update`, `systemPrompt.section`, the typert `Remote` mount, the gateway `$mount` contract, `slots.inject/register`, the `settings.section` slot, the `dsh.bundle.patch` install path, and the dynamic-plugin builtins all kept their shapes.

The client manifest lists both harness bootstraps under `dsh.client.inject` (`@deepseek-ai/dsh-client-runtime` for 0.1.1-rc.x, `@deepseek-ai/dsh-client-web` for 0.1.2-rc.1 and later): 0.1.2 dissolved the old runtime package, and every loader so far silently skips an inject name it does not ship, so one manifest works on both lines.

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
