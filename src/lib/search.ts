/**
 * Parse complex search query syntax
 * Supports: from:@alice tag:billing before:2024-01-01
 */
export interface ParsedQuery {
  text: string // Main search text
  from?: string // User email or name filter
  tag?: string // Tag filter
  before?: Date // Date filter (before this date)
  after?: Date // Date filter (after this date)
}

export function parseSearchQuery(query: string): ParsedQuery {
  const result: ParsedQuery = { text: '' }
  
  // Patterns for special syntax
  const fromPattern = /from:(\S+)/gi
  const tagPattern = /tag:(\S+)/gi
  const beforePattern = /before:(\S+)/gi
  const afterPattern = /after:(\S+)/gi
  
  let processedQuery = query
  
  // Extract from: filter
  const fromMatch = fromPattern.exec(query)
  if (fromMatch) {
    result.from = fromMatch[1].replace(/^@/, '') // Remove @ if present
    processedQuery = processedQuery.replace(fromPattern, '').trim()
  }
  
  // Extract tag: filter
  const tagMatch = tagPattern.exec(query)
  if (tagMatch) {
    result.tag = tagMatch[1]
    processedQuery = processedQuery.replace(tagPattern, '').trim()
  }
  
  // Extract before: filter
  const beforeMatch = beforePattern.exec(query)
  if (beforeMatch) {
    const dateStr = beforeMatch[1]
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      result.before = date
    }
    processedQuery = processedQuery.replace(beforePattern, '').trim()
  }
  
  // Extract after: filter
  const afterMatch = afterPattern.exec(query)
  if (afterMatch) {
    const dateStr = afterMatch[1]
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      result.after = date
    }
    processedQuery = processedQuery.replace(afterPattern, '').trim()
  }
  
  // Remaining text is the main search query
  result.text = processedQuery.trim()
  
  return result
}

/**
 * Generate PostgreSQL tsquery from parsed query
 */
export function buildTsQuery(text: string): string {
  if (!text) return ''
  
  // Split into words and join with & (AND) operator
  const words = text
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => w.replace(/[^\w]/g, '')) // Remove special chars
    .filter(w => w.length > 0)
  
  if (words.length === 0) return ''
  
  // Use phrase search with & operator for better results
  return words.join(' & ')
}

/**
 * Extract snippet from text with highlighting markers
 */
export function extractSnippet(text: string, query: string, maxLength: number = 200): string {
  if (!text) return ''
  
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0)
  
  // Find first occurrence of any query word
  let startIndex = -1
  for (const word of queryWords) {
    const index = lowerText.indexOf(word)
    if (index !== -1 && (startIndex === -1 || index < startIndex)) {
      startIndex = index
    }
  }
  
  if (startIndex === -1) {
    // No match found, return beginning
    return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '')
  }
  
  // Extract snippet around match
  const contextBefore = Math.floor(maxLength / 2)
  const contextAfter = Math.floor(maxLength / 2)
  
  let snippetStart = Math.max(0, startIndex - contextBefore)
  let snippetEnd = Math.min(text.length, startIndex + queryWords[0].length + contextAfter)
  
  // Try to start at word boundary
  while (snippetStart > 0 && text[snippetStart] !== ' ') {
    snippetStart--
  }
  
  // Try to end at word boundary
  while (snippetEnd < text.length && text[snippetEnd] !== ' ') {
    snippetEnd++
  }
  
  let snippet = text.slice(snippetStart, snippetEnd)
  
  // Add ellipsis if needed
  if (snippetStart > 0) snippet = '...' + snippet
  if (snippetEnd < text.length) snippet = snippet + '...'
  
  return snippet
}

/**
 * Highlight query terms in text
 */
export function highlightText(text: string, query: string): string {
  if (!text || !query) return text
  
  const queryWords = query.split(/\s+/).filter(w => w.length > 0)
  let highlighted = text
  
  for (const word of queryWords) {
    const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    highlighted = highlighted.replace(regex, '<mark>$1</mark>')
  }
  
  return highlighted
}

