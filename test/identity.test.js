/**
 * Identity drift guard.
 *
 * The npm package name is duplicated on purpose: the browser half is a lazy
 * CJS factory that cannot import package.json, and the host half keeps a
 * literal so the typert wire ids stay stable. The three copies must agree,
 * or the host and client manifests stop pairing and the Settings page breaks.
 * This test reads sources as text so a fresh clone needs no peer deps.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const remoteSource = await readFile(new URL('../lib/remote.js', import.meta.url), 'utf8')
const clientSource = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

function literal(source, pattern, label) {
  const match = source.match(pattern)
  assert.ok(match, `${label} not found`)
  return match[1]
}

test('PACKAGE constants match the npm package name', () => {
  const hostPackage = literal(remoteSource, /^export const PACKAGE = '(.*)'$/m, 'lib/remote.js PACKAGE')
  const clientPackage = literal(clientSource, /^\s*const PACKAGE = '(.*)'$/m, 'lib/client.js PACKAGE')
  assert.equal(hostPackage, pkg.name)
  assert.equal(clientPackage, pkg.name)
})

test('browser module id matches the npm package name', () => {
  const moduleId = literal(
    clientSource,
    /window\.__ModuleLoader__\.load\(\{\s*\n\s*id: '(.*)',/,
    'lib/client.js module id'
  )
  assert.equal(moduleId, pkg.name)
})

test('dynamic form keeps its plain cordis-safe identity', async () => {
  const bundle = JSON.parse(
    await readFile(new URL('../dynamic/dsh-output-styles.dynamic.json', import.meta.url), 'utf8')
  )
  assert.equal(bundle.kind, 'dsh-dynamic-cordis-plugin')
  assert.equal(bundle.name, 'dsh-output-styles')
  assert.doesNotMatch(bundle.name, /[@/]/)
})

test('composition example resolves the installed package name', async () => {
  const example = await readFile(new URL('../cordis.patch.example.yml', import.meta.url), 'utf8')
  assert.match(example, new RegExp(`name: '${pkg.name.replace(/[/@]/g, (c) => `\\${c}`)}'`))
})

test('client manifest injects the current web bootstrap', () => {
  const client = pkg.dsh.client
  assert.equal(client.platform, 'web')
  // 0.1.7 is the only supported line. dsh-client-web is its web bootstrap;
  // the legacy dsh-client-runtime that 0.1.1-rc.x shipped is gone.
  assert.deepEqual(client.inject, ['@deepseek-ai/dsh-client-web'])
})

test('typert-protocol peer range admits only the 0.1.7 harness line', () => {
  const range = pkg.peerDependencies['@deepseek-ai/dsh-typert-protocol']
  // Strict semver only matches a prerelease when a comparator carries a
  // prerelease tag on the same major.minor.patch tuple. 0.1.7 replaced the
  // codec `schema` property with a `create()` factory, so the older
  // per-tuple clauses cannot be honoured any more and were dropped.
  assert.match(range, /\^0\.1\.7-rc\.1/)
  assert.doesNotMatch(range, /0\.1\.5/)
  assert.doesNotMatch(range, /0\.1\.2/)
  assert.doesNotMatch(range, /0\.1\.1/)
  assert.doesNotMatch(range, /0\.1\.0/)
})

test('schemastery peer range admits the volatile-aware line', () => {
  const range = pkg.peerDependencies['@deepseek-ai/schemastery']
  // `.volatile()` (the only editable-config mechanism in 0.1.7) first appears
  // in 3.18.3; the 0.1.7 harness ships 3.18.4.
  assert.match(range, /\^3\.18\.4/)
})

test('host half exports a Config schema with volatile editable fields', async () => {
  const hostSource = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8')
  assert.match(hostSource, /^export const Config = z\.object\(/m, 'lib/index.js must export the plugin Config schema')
  assert.match(hostSource, /\.volatile\(\)/, 'editable Config fields must be volatile')
})

test('codecs expose a create() factory and no legacy schema property', () => {
  for (const [label, source] of [
    ['lib/remote.js', remoteSource],
    ['lib/client.js', clientSource],
  ]) {
    assert.match(source, /create: schemaFor\(parse\)/, `${label} must build codecs with a create() factory`)
    assert.doesNotMatch(source, /_zod:/, `${label} must not carry the removed _zod-backed schema`)
  }
})
