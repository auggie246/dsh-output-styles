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
