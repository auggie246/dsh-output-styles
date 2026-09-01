# @auggieteo/dsh-output-styles

Output styles for [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) Web (`dsh web`): choose a built-in style or create your own from the Settings page.

## Install

```sh
dsh plugin --profile web add @auggieteo/dsh-output-styles
```

Then append the composition row from [`cordis.patch.example.yml`](cordis.patch.example.yml) to `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: output-styles
      name: '@auggieteo/dsh-output-styles'
```

Restart `dsh web` and open **Settings → Output Style**.

Requires `@deepseek-ai/dsh` 0.1.0-rc.7 or compatible with the web profile, and Node.js 20+. All runtime dependencies are peers provided by DSH.

Other sources:

```sh
dsh plugin --profile web add github:auggie246/dsh-output-styles   # from GitHub
dsh plugin --profile web add /path/to/dsh-output-styles           # from a local checkout
```

Git installs run a `prepare` build that pnpm blocks until allowlisted: add the exact key pnpm prints under `allowBuilds` in `~/.dsh/profiles/web/pnpm-workspace.yaml`, then re-run the same command.

## Usage

Open **Settings → Output Style**:

- Pick a built-in style, or create a named style with a name, an optional description, and Markdown instructions.
- **Edit** turns a style's own row into the edit form; **Save** or **Cancel** restores it. The create form hides while an edit is open.
- The selected style enters every agent's system prompt from the **next model step** — no restart needed.
- User styles persist across restarts in `~/.dsh/settings.yaml` (the `output-styles` namespace). The style section is global to the deployment, not per-session.

### Pasting style files

The Instructions field accepts a whole style file — Claude Code output styles and Agent Skills `SKILL.md`. Its frontmatter fills Name and Description; only the body is stored as instructions. The empty field shows a complete example.

Other frontmatter keys (`keep-coding-instructions`, `disable-model-invocation`, `metadata`, …) are reported as ignored: the plugin appends its section to the system prompt, so the harness coding instructions are always kept and behavior flags have no effect. Only flat `key: value` frontmatter is supported.

## Built-in styles

| Style       | Effect                                                       |
| ----------- | ------------------------------------------------------------ |
| Default     | No style instructions added.                                 |
| Concise     | Short, telegraphic answers; result first; no recaps.         |
| Explanatory | Adds reasoning, rejected alternatives, and tradeoffs.        |
| Learning    | Teaches while working; best practices and pitfalls.          |
| Formal      | Documentation tone: headings, precise terms, numbered steps. |

## Session-only install

An agent can define the plugin into a running DSH process — no files touch the deployment, and it disappears when that process restarts. See [`dynamic/README.md`](dynamic/README.md). If both forms are active at once, both contribute their own prompt section; pick one form.

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
The plugin is not wired: check the `insert:` row in `~/.dsh/profiles/web/cordis.patch.yml` and restart `dsh web`.

**`dsh web` crashes at boot with `TYPERT manifest names package ...`.**
The plugin is installed under a different dependency key than its npm name (for example, the pre-rename `dsh-output-styles` with a `file:`/`link:` path). The dependency key in `~/.dsh/profiles/web/package.json`, the insert `name:` in `cordis.patch.yml`, and the package name must all be the same string, `@auggieteo/dsh-output-styles`. Renaming does not move data: the cordis plugin id (`output-styles`), the settings namespace, and stored styles are unchanged.

## License

[MIT](LICENSE)
