/** Shared output-style catalog and state helpers. */

export const MAX_USER_STYLES = 50
export const MAX_STYLE_NAME_LENGTH = 80
export const MAX_STYLE_INSTRUCTIONS_LENGTH = 4000
/** Agent Skills spec cap for the `description` frontmatter field. */
export const MAX_STYLE_DESCRIPTION_LENGTH = 1024
export const LEGACY_STYLE_ID = 'user:custom'

// BEGIN frontmatter parser (keep in sync across lib/catalog.js, lib/client.js, dynamic/host.js, dynamic/client.js)
function stripMatchingQuotes(value) {
  if (value.length >= 2) {
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) return value.slice(1, -1)
  }
  return value
}

// Minimal frontmatter reader for pasted style files (Claude Code output
// styles, Agent Skills SKILL.md). Supports flat "key: value" lines with
// optional matching quotes. Indented lines inside the block (nested YAML
// mappings such as `metadata:`) are skipped as ignored content.
function parseStyleFrontmatter(text) {
  const raw = typeof text === 'string' ? text : ''
  const failure = (error) => ({ hasFrontmatter: true, body: raw, name: null, description: null, ignoredKeys: [], error })
  const lines = raw.split('\n')
  let start = 0
  while (start < lines.length && lines[start].trim() === '') start += 1
  if (lines[start] !== '---') {
    return { hasFrontmatter: false, body: raw, name: null, description: null, ignoredKeys: [], error: null }
  }
  const fields = new Map()
  let index = start + 1
  let closed = false
  while (index < lines.length) {
    const line = lines[index]
    if (line === '---' || line === '...') {
      closed = true
      index += 1
      break
    }
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      index += 1
      continue
    }
    if (/^\s/.test(line)) {
      index += 1
      continue
    }
    const colon = line.indexOf(':')
    if (colon === -1) return failure('expected "key: value": "' + trimmed + '"')
    const key = line.slice(0, colon).trim()
    if (key === '') return failure('empty frontmatter key: "' + trimmed + '"')
    fields.set(key, stripMatchingQuotes(line.slice(colon + 1).trim()))
    index += 1
  }
  if (!closed) return failure('the frontmatter block is never closed with a "---" line')
  const body = lines.slice(index).join('\n').replace(/^\n+/, '')
  const name = fields.get('name') || null
  const description = fields.get('description') || null
  const ignoredKeys = []
  for (const key of fields.keys()) {
    if (key !== 'name' && key !== 'description') ignoredKeys.push(key)
  }
  return { hasFrontmatter: true, body, name, description, ignoredKeys, error: null }
}
// END frontmatter parser

export { parseStyleFrontmatter }

// BEGIN style draft resolver (keep in sync across lib/catalog.js and dynamic/host.js)
// Applies pasted frontmatter to a save draft. Explicit arguments win; the
// frontmatter fills the gaps. Throws plain errors for the caller to prefix.
function resolveStyleDraft(name, instructions, description) {
  const parsed = parseStyleFrontmatter(typeof instructions === 'string' ? instructions : '')
  if (parsed.error !== null) throw new Error(parsed.error)
  const typedName = typeof name === 'string' ? name.trim() : ''
  const typedDescription = typeof description === 'string' ? description.trim() : ''
  const resolvedName = typedName !== '' ? typedName : parsed.name !== null ? parsed.name : ''
  const resolvedInstructions = parsed.hasFrontmatter ? parsed.body : typeof instructions === 'string' ? instructions : ''
  const resolvedDescription = typedDescription !== '' ? typedDescription : parsed.description !== null ? parsed.description : ''
  if (resolvedName === '') throw new Error('style name is required')
  if (resolvedName.length > MAX_STYLE_NAME_LENGTH) throw new Error('style name exceeds ' + MAX_STYLE_NAME_LENGTH + ' characters')
  if (resolvedInstructions.trim() === '') throw new Error('style instructions are required')
  if (resolvedInstructions.length > MAX_STYLE_INSTRUCTIONS_LENGTH) {
    throw new Error('style instructions exceed ' + MAX_STYLE_INSTRUCTIONS_LENGTH + ' characters')
  }
  if (resolvedDescription.length > MAX_STYLE_DESCRIPTION_LENGTH) {
    throw new Error('style description exceeds ' + MAX_STYLE_DESCRIPTION_LENGTH + ' characters')
  }
  return { name: resolvedName, instructions: resolvedInstructions, description: resolvedDescription }
}
// END style draft resolver

export { resolveStyleDraft }

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
    const description =
      typeof entry.description === 'string'
        ? entry.description.trim().slice(0, MAX_STYLE_DESCRIPTION_LENGTH)
        : ''
    if (name === '' || instructions.trim() === '') continue
    ids.add(entry.id)
    result.push({ id: entry.id, name, instructions, description })
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
      userStyles.push({ id: LEGACY_STYLE_ID, name: 'Custom', instructions, description: '' })
    }
    selectedId = instructions === '' ? 'default' : LEGACY_STYLE_ID
    migrated = true
  }

  if (!isKnownStyle(selectedId, userStyles)) selectedId = 'default'
  return { selectedId, userStyles, migrated }
}
