# Changelog

All notable changes to this project are documented in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-09-01

### Added

- User styles carry an optional `description`: stored in the settings
  document, shown under the style name, capped at 1024 characters (the
  Agent Skills description limit). It flows through the wire codecs, the
  save invocation, and storage normalization.
- Pasting a whole style file into Instructions (Claude Code output styles,
  Agent Skills `SKILL.md`) extracts its frontmatter: `name` and
  `description` fill their fields, the body becomes the instructions, and
  other keys are reported as ignored (this plugin appends to the system
  prompt, so behavior flags have no effect). Only flat `key: value`
  frontmatter is supported.
- The Settings page edits a style in place: **Edit** turns the style's own
  row into the edit form, and the create form hides while an edit is open.
  **Save style** or **Cancel** returns the row to its normal display.
- The Instructions field is labelled Markdown, uses a monospace font, and
  its empty-state placeholder shows a complete example style file with
  frontmatter.
- `test/parser-sync.test.js` keeps the frontmatter parser and the style
  draft resolver byte-identical across `lib/catalog.js`, `lib/client.js`,
  `dynamic/host.js`, and `dynamic/client.js`.

### Changed

- The `save` invocation now takes a `description` argument. Host and
  client ship in one package, so no mixed-version pairing is supported or
  expected.

## [0.2.0] - 2026-08-30

### Added

- The package installs as a dsh profile bundle: `dsh.bundle.patch` in
  `package.json`, plus `cordis.patch.example.yml` to copy into the profile
  patch layer.
- Identity drift-guard tests: the duplicated package-name literals in
  `lib/remote.js`, `lib/client.js`, and the dynamic bundle must match
  `package.json`, or the Settings page breaks.

### Changed

- Published as the scoped `@auggieteo/dsh-output-styles`, public by
  default. The pre-rename `dsh-output-styles` name is retired; the cordis
  plugin id, the settings namespace, and stored styles are unchanged.
- README documents the npm and git install routes, the pnpm `allowBuilds`
  gotcha for git installs, and the TYPERT manifest ownership crash with
  its three-step lockstep fix.

## [0.1.0] - 2026-08-23

### Added

- Initial release: built-in styles (Default, Concise, Explanatory,
  Learning, Formal) and persistent user styles stored in the harness
  settings document (`output-styles` namespace in `~/.dsh/settings.yaml`).
- Settings page to select a style and create, edit, or delete user styles.
- The selected style enters every agent's system prompt from the next
  model step, registered right after the persona (order 5).
- Session-only dynamic plugin form (`dynamic/`), bundled by
  `npm run bundle:dynamic` and defined into a running DSH process with
  `cordis_define`.
