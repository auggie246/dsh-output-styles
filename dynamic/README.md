# dynamic/ — session-only install bundle

These files are the **dynamic Cordis plugin** form of dsh-output-styles: the
same output-style selector, but installed into a *running* DSH process by an
agent (the `cordis_define`/`cordis_run` tools) with zero changes to the
deployment. It disappears when that DSH process restarts, and its selection
is kept in process memory only.

- `host.js` — the `code.host` function body (prompt section + state RPC).
- `client.js` — the `code.client` function body (the Settings page).
- `dsh-output-styles.dynamic.json` — generated single-file bundle
  (`{ name, version, host, client }`) produced by
  `npm run bundle:dynamic` (`scripts/bundle-dynamic.mjs`). Share this one file.

## Install (session-only)

Paste this into a DSH session whose agent has the Cordis tools:

> Read `dynamic/dsh-output-styles.dynamic.json`. Call `cordis_define` with a
> new plugin, using its `name` and `description`, and its `host` and `client`
> strings as `code.host` and `code.client`. Then `cordis_run` the returned
> package. I'll approve the activation.

For a permanent install that survives DSH restarts, see the root
[README](../README.md) — that path uses `lib/` instead.
