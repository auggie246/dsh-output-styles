import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LEGACY_STYLE_ID,
  MAX_STYLE_DESCRIPTION_LENGTH,
  MAX_USER_STYLES,
  PRESETS,
  isKnownStyle,
  normalizeUserStyles,
  parseStyleFrontmatter,
  promptFor,
  readStoredState,
  resolveStyleDraft,
} from '../lib/catalog.js'

test('built-in catalog has no custom placeholder', () => {
  assert.equal(PRESETS.some((preset) => preset.id === 'custom'), false)
})

test('user-created style can be selected and rendered', () => {
  const userStyles = [
    { id: 'user:wait-what', name: 'Wait What', instructions: 'Start with context.' },
  ]

  assert.equal(isKnownStyle('user:wait-what', userStyles), true)
  assert.equal(promptFor('user:wait-what', userStyles), 'Start with context.')
})

test('stored user styles and selection survive state reconstruction', () => {
  const stored = {
    selectedId: 'user:durable',
    userStyles: [
      { id: 'user:durable', name: 'Durable', instructions: 'Use short sentences.' },
    ],
  }

  assert.deepEqual(readStoredState(structuredClone(stored)), {
    selectedId: 'user:durable',
    userStyles: [
      { id: 'user:durable', name: 'Durable', instructions: 'Use short sentences.', description: '' },
    ],
    migrated: false,
  })
})

test('legacy custom instructions migrate into a named user style', () => {
  const state = readStoredState({ mode: 'custom', custom: 'Explain each decision.', userStyles: [] })

  assert.equal(state.selectedId, LEGACY_STYLE_ID)
  assert.deepEqual(state.userStyles, [
    { id: LEGACY_STYLE_ID, name: 'Custom', instructions: 'Explain each decision.', description: '' },
  ])
  assert.equal(state.migrated, true)
})

test('legacy migration stays within the user-style limit', () => {
  const userStyles = Array.from({ length: MAX_USER_STYLES }, (_, index) => ({
    id: `user:style-${index}`,
    name: `Style ${index}`,
    instructions: `Instructions ${index}.`,
  }))

  const state = readStoredState({ mode: 'custom', custom: 'Legacy instructions.', userStyles })

  assert.equal(state.userStyles.length, MAX_USER_STYLES)
  assert.equal(state.userStyles.at(-1).id, LEGACY_STYLE_ID)
})

test('invalid and duplicate stored user styles are discarded', () => {
  assert.deepEqual(
    normalizeUserStyles([
      { id: 'bad id', name: 'Bad', instructions: 'Bad.' },
      { id: 'user:one', name: ' One ', instructions: 'First.' },
      { id: 'user:one', name: 'Duplicate', instructions: 'Second.' },
      { id: 'user:empty', name: '', instructions: 'Missing name.' },
    ]),
    [{ id: 'user:one', name: 'One', instructions: 'First.', description: '' }]
  )
})

test('stored descriptions are trimmed and capped', () => {
  const long = 'x'.repeat(MAX_STYLE_DESCRIPTION_LENGTH + 50)
  assert.deepEqual(
    normalizeUserStyles([{ id: 'user:desc', name: 'Described', instructions: 'Body.', description: '  ' + long + '  ' }]),
    [{ id: 'user:desc', name: 'Described', instructions: 'Body.', description: long.slice(0, MAX_STYLE_DESCRIPTION_LENGTH) }]
  )
})

const WAIT_WHAT_FILE = [
  '---',
  'name: Wait What',
  'description: "Re-pitches every answer with context, in Simplified Technical English."',
  'keep-coding-instructions: true',
  '---',
  '',
  'Talk in ASD-STE100 Simplified Technical English.',
  '',
].join('\n')

test('frontmatter is extracted from a pasted style file', () => {
  const parsed = parseStyleFrontmatter(WAIT_WHAT_FILE)

  assert.equal(parsed.hasFrontmatter, true)
  assert.equal(parsed.error, null)
  assert.equal(parsed.name, 'Wait What')
  assert.equal(parsed.description, 'Re-pitches every answer with context, in Simplified Technical English.')
  assert.deepEqual(parsed.ignoredKeys, ['keep-coding-instructions'])
  assert.equal(parsed.body, 'Talk in ASD-STE100 Simplified Technical English.\n')
})

test('agent-skills frontmatter parses with quoted values and unknown keys', () => {
  const file = [
    '---',
    'name: wait-what',
    'description: "Stop. That last message did not land: re-pitch it."',
    'disable-model-invocation: true',
    'metadata:',
    '  author: mattpocock',
    '---',
    '',
    'Re-pitch that.',
  ].join('\n')
  const parsed = parseStyleFrontmatter(file)

  assert.equal(parsed.error, null)
  assert.equal(parsed.name, 'wait-what')
  assert.equal(parsed.description, 'Stop. That last message did not land: re-pitch it.')
  assert.deepEqual(parsed.ignoredKeys, ['disable-model-invocation', 'metadata'])
  assert.equal(parsed.body, 'Re-pitch that.')
})

test('plain instructions without frontmatter pass through untouched', () => {
  const parsed = parseStyleFrontmatter('Just talk plainly.\n')

  assert.equal(parsed.hasFrontmatter, false)
  assert.equal(parsed.name, null)
  assert.equal(parsed.description, null)
  assert.deepEqual(parsed.ignoredKeys, [])
  assert.equal(parsed.body, 'Just talk plainly.\n')
  assert.equal(parsed.error, null)
})

test('malformed frontmatter is rejected with a clear error', () => {
  assert.match(parseStyleFrontmatter('---\nname: x\n').error, /never closed/)
  assert.match(parseStyleFrontmatter('---\nnot a mapping\n---\nbody').error, /expected "key: value"/)
  assert.match(parseStyleFrontmatter('---\n: value\n---\nbody').error, /empty frontmatter key/)
})

test('resolveStyleDraft fills gaps from frontmatter and prefers typed values', () => {
  assert.deepEqual(resolveStyleDraft('', WAIT_WHAT_FILE, ''), {
    name: 'Wait What',
    instructions: 'Talk in ASD-STE100 Simplified Technical English.\n',
    description: 'Re-pitches every answer with context, in Simplified Technical English.',
  })
  const typed = resolveStyleDraft('Typed Name', WAIT_WHAT_FILE, 'Typed description')
  assert.equal(typed.name, 'Typed Name')
  assert.equal(typed.description, 'Typed description')
  assert.equal(typed.instructions, 'Talk in ASD-STE100 Simplified Technical English.\n')
})

test('resolveStyleDraft keeps its limits', () => {
  assert.throws(() => resolveStyleDraft('', 'Body only.', ''), /style name is required/)
  assert.throws(() => resolveStyleDraft('N', '   ', ''), /style instructions are required/)
  assert.throws(
    () => resolveStyleDraft('N', 'Body.', 'x'.repeat(MAX_STYLE_DESCRIPTION_LENGTH + 1)),
    /style description exceeds 1024 characters/
  )
  assert.throws(() => resolveStyleDraft('N', '---\nname: x\n', ''), /never closed/)
})
