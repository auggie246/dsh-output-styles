/** Shared output-style catalog and state helpers. */

export const MAX_USER_STYLES = 50
export const MAX_STYLE_NAME_LENGTH = 80
export const MAX_STYLE_INSTRUCTIONS_LENGTH = 4000
export const LEGACY_STYLE_ID = 'user:custom'

export const PRESETS = [
  {
    id: 'default',
    label: 'Default',
    description: 'No output-style instructions are added to the system prompt.',
    prompt: '',
  },
  {
    id: 'concise',
    label: 'Concise',
    description: 'Short, telegraphic answers: result first, minimal prose, no recaps.',
    prompt:
      'Keep every response brief and telegraphic. Lead with the answer or the action taken. ' +
      'Do not restate the request, do not announce what you are about to do, and do not close ' +
      'with a summary. Prefer tight bullet lists and code blocks over prose paragraphs.',
  },
  {
    id: 'explanatory',
    label: 'Explanatory',
    description: 'Adds reasoning: why an approach was chosen, alternatives, and tradeoffs.',
    prompt:
      'After completing each task, briefly explain your reasoning: why you chose this approach, ' +
      'which alternatives you considered and rejected, and the tradeoffs involved. ' +
      'Explicitly flag any assumptions you had to make. Keep these explanations compact and ' +
      'separate from the result itself.',
  },
  {
    id: 'learning',
    label: 'Learning',
    description: 'Teaches while working: explains concepts and points out best practices.',
    prompt:
      'Teach while you work. Explain concepts as they come up, point out best practices and ' +
      'common pitfalls relevant to the current task, and when the task has an educational ' +
      'component, describe what the user could implement themselves before you fill in the rest. ' +
      'Keep teaching notes concise so the work itself stays front and center.',
  },
  {
    id: 'formal',
    label: 'Formal',
    description: 'Structured, documentation-tone responses with clear headings.',
    prompt:
      'Write responses in a formal, documentation-like register. Use clear section headings, ' +
      'precise terminology, numbered lists for procedures, and complete sentences. ' +
      'Avoid colloquialisms and first-person asides.',
  },
]

const PRESET_IDS = new Set(PRESETS.map((preset) => preset.id))

export function isBuiltInStyle(styleId) {
  return PRESET_IDS.has(styleId)
}

export function isUserStyleId(styleId) {
  return typeof styleId === 'string' && /^user:[A-Za-z0-9_-]+$/.test(styleId)
}

export function normalizeUserStyles(value) {
  if (!Array.isArray(value)) return []
  const result = []
  const ids = new Set()
  for (const entry of value) {
    if (result.length >= MAX_USER_STYLES) break
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue
    if (!isUserStyleId(entry.id) || ids.has(entry.id)) continue
    const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, MAX_STYLE_NAME_LENGTH) : ''
    const instructions =
      typeof entry.instructions === 'string'
        ? entry.instructions.slice(0, MAX_STYLE_INSTRUCTIONS_LENGTH)
        : ''
    if (name === '' || instructions.trim() === '') continue
    ids.add(entry.id)
    result.push({ id: entry.id, name, instructions })
  }
  return result
}

export function isKnownStyle(styleId, userStyles = []) {
  return isBuiltInStyle(styleId) || userStyles.some((style) => style.id === styleId)
}

export function promptFor(styleId, userStyles = []) {
  const preset = PRESETS.find((entry) => entry.id === styleId)
  if (preset) return preset.prompt
  const userStyle = userStyles.find((entry) => entry.id === styleId)
  return userStyle ? userStyle.instructions.trim() : ''
}

export function readStoredState(value) {
  const stored = value && typeof value === 'object' ? value : {}
  const userStyles = normalizeUserStyles(stored.userStyles)
  let selectedId = typeof stored.selectedId === 'string' ? stored.selectedId : stored.mode
  let migrated = false

  if (selectedId === 'custom') {
    const instructions = typeof stored.custom === 'string' ? stored.custom.trim() : ''
    if (instructions !== '' && !userStyles.some((style) => style.id === LEGACY_STYLE_ID)) {
      if (userStyles.length >= MAX_USER_STYLES) userStyles.pop()
      userStyles.push({ id: LEGACY_STYLE_ID, name: 'Custom', instructions })
    }
    selectedId = instructions === '' ? 'default' : LEGACY_STYLE_ID
    migrated = true
  }

  if (!isKnownStyle(selectedId, userStyles)) selectedId = 'default'
  return { selectedId, userStyles, migrated }
}
