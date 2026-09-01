import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const PARSER_FILES = ['lib/catalog.js', 'lib/client.js', 'dynamic/host.js', 'dynamic/client.js']
const RESOLVER_FILES = ['lib/catalog.js', 'dynamic/host.js']

// The copies may sit at different indentation depths (the browser factory
// indents by four spaces). Comparison strips the block's common indent.
function extractMarkedBlock(source, file, beginMarker, endMarker) {
  const begin = source.indexOf(beginMarker)
  assert.notEqual(begin, -1, `${file}: missing marker "${beginMarker}"`)
  const beginLineStart = source.lastIndexOf('\n', begin) + 1
  const endMarkerPos = source.indexOf(endMarker, begin)
  assert.notEqual(endMarkerPos, -1, `${file}: missing marker "${endMarker}"`)
  const endLineEnd = source.indexOf('\n', endMarkerPos)
  const lines = source
    .slice(beginLineStart, endLineEnd === -1 ? source.length : endLineEnd)
    .split('\n')
  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => line.match(/^ */)[0].length)
  const strip = Math.min(...indents)
  return lines.map((line) => line.slice(strip)).join('\n').trim()
}

async function assertBlocksInSync(files, beginMarker, endMarker, label) {
  const blocks = []
  for (const file of files) {
    const source = await readFile(new URL('../' + file, import.meta.url), 'utf8')
    blocks.push([file, extractMarkedBlock(source, file, beginMarker, endMarker)])
  }
  const [, firstBlock] = blocks[0]
  for (const [file, block] of blocks.slice(1)) {
    assert.equal(block, firstBlock, `${label} copy in ${file} differs from ${blocks[0][0]}`)
  }
}

test('frontmatter parser copies stay in sync', async () => {
  await assertBlocksInSync(
    PARSER_FILES,
    '// BEGIN frontmatter parser',
    '// END frontmatter parser',
    'frontmatter parser'
  )
})

test('style draft resolver copies stay in sync', async () => {
  await assertBlocksInSync(
    RESOLVER_FILES,
    '// BEGIN style draft resolver',
    '// END style draft resolver',
    'style draft resolver'
  )
})
