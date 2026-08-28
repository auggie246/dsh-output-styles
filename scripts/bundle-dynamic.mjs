/**
 * Builds the single-file dynamic-plugin bundle from dynamic/host.js and
 * dynamic/client.js. Run after editing either file:
 *
 *   npm run bundle:dynamic
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

// The dynamic form has its own identity: cordis_define expects a plain name,
// and the npm package name may be scoped (an @scope/name would break the
// output path below). Do not derive it from pkg.name.
const PLUGIN_NAME = 'dsh-output-styles'
const host = await readFile(join(root, 'dynamic/host.js'), 'utf8')
const client = await readFile(join(root, 'dynamic/client.js'), 'utf8')

const bundle = {
  kind: 'dsh-dynamic-cordis-plugin',
  name: PLUGIN_NAME,
  version: pkg.version,
  description: pkg.description,
  host,
  client,
}

const out = join(root, 'dynamic', `${PLUGIN_NAME}.dynamic.json`)
await writeFile(out, JSON.stringify(bundle, null, 2) + '\n')
console.log(`wrote ${out}`)
