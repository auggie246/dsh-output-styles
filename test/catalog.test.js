import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LEGACY_STYLE_ID,
  MAX_USER_STYLES,
  PRESETS,
  isKnownStyle,
  normalizeUserStyles,
  promptFor,
  readStoredState,
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
    userStyles: stored.userStyles,
    migrated: false,
  })
})

test('legacy custom instructions migrate into a named user style', () => {
  const state = readStoredState({ mode: 'custom', custom: 'Explain each decision.', userStyles: [] })

  assert.equal(state.selectedId, LEGACY_STYLE_ID)
  assert.deepEqual(state.userStyles, [
    { id: LEGACY_STYLE_ID, name: 'Custom', instructions: 'Explain each decision.' },
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
    [{ id: 'user:one', name: 'One', instructions: 'First.' }]
  )
})
