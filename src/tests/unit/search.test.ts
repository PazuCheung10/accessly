import { describe, it, expect } from 'vitest'
import { parseSearchQuery, buildTsQuery, extractSnippet, highlightText } from '@/lib/search'

describe('Search Utilities', () => {
  describe('parseSearchQuery', () => {
    it('should parse simple text query', () => {
      const result = parseSearchQuery('password reset')
      expect(result.text).toBe('password reset')
      expect(result.filters.from).toBeUndefined()
      expect(result.filters.tag).toBeUndefined()
    })

    it('should parse from: filter', () => {
      const result = parseSearchQuery('from:@alice password reset')
      expect(result.text).toBe('password reset')
      expect(result.filters.from).toBe('alice')
    })

    it('should parse tag: filter', () => {
      const result = parseSearchQuery('tag:billing issue')
      expect(result.text).toBe('issue')
      expect(result.filters.tag).toBe('billing')
    })

    it('should parse before: date filter', () => {
      const result = parseSearchQuery('before:2024-01-01 search term')
      expect(result.text).toBe('search term')
      expect(result.filters.before).toBe('2024-01-01')
    })

    it('should parse after: date filter', () => {
      const result = parseSearchQuery('after:2024-01-01 search term')
      expect(result.text).toBe('search term')
      expect(result.filters.after).toBe('2024-01-01')
    })

    it('should parse multiple filters', () => {
      const result = parseSearchQuery('from:@alice tag:billing before:2024-01-01 issue')
      expect(result.text).toBe('issue')
      expect(result.filters.from).toBe('alice')
      expect(result.filters.tag).toBe('billing')
      expect(result.filters.before).toBe('2024-01-01')
    })

    it('should handle empty query', () => {
      const result = parseSearchQuery('')
      expect(result.text).toBe('')
    })

    it('should handle query with only filters', () => {
      const result = parseSearchQuery('from:@alice tag:billing')
      expect(result.text).toBe('')
      expect(result.filters.from).toBe('alice')
      expect(result.filters.tag).toBe('billing')
    })
  })

  describe('buildTsQuery', () => {
    it('should build AND query from words', () => {
      const result = buildTsQuery('password reset')
      expect(result).toBe('password & reset')
    })

    it('should handle single word', () => {
      const result = buildTsQuery('password')
      expect(result).toBe('password')
    })

    it('should remove special characters', () => {
      const result = buildTsQuery('password-reset!')
      expect(result).toBe('passwordreset')
    })

    it('should handle empty string', () => {
      const result = buildTsQuery('')
      expect(result).toBe('')
    })

    it('should handle multiple spaces', () => {
      const result = buildTsQuery('password   reset   issue')
      expect(result).toBe('password & reset & issue')
    })
  })

  describe('extractSnippet', () => {
    it('should extract snippet around match', () => {
      const text = 'This is a long message about password reset functionality that users need'
      const snippet = extractSnippet(text, 'password reset', 50)
      expect(snippet).toContain('password reset')
      expect(snippet.length).toBeLessThanOrEqual(50 + 3) // +3 for ellipsis
    })

    it('should return beginning if no match found', () => {
      const text = 'This is a message without the search term'
      const snippet = extractSnippet(text, 'password', 50)
      expect(snippet).toBe(text.slice(0, 50) + '...')
    })

    it('should handle empty text', () => {
      const snippet = extractSnippet('', 'password', 50)
      expect(snippet).toBe('')
    })

    it('should handle text shorter than maxLength', () => {
      const text = 'Short text'
      const snippet = extractSnippet(text, 'text', 200)
      expect(snippet).toBe('Short text')
    })

    it('should try to start at word boundary', () => {
      const text = 'This is a message about password reset functionality'
      const snippet = extractSnippet(text, 'password', 30)
      // Should try to start at word boundary
      expect(snippet).toContain('password')
    })
  })

  describe('highlightText', () => {
    it('should highlight query words', () => {
      const text = 'This is about password reset'
      const highlighted = highlightText(text, 'password reset')
      expect(highlighted).toContain('<mark>password</mark>')
      expect(highlighted).toContain('<mark>reset</mark>')
    })

    it('should be case-insensitive', () => {
      const text = 'This is about PASSWORD RESET'
      const highlighted = highlightText(text, 'password reset')
      expect(highlighted).toContain('<mark>PASSWORD</mark>')
      expect(highlighted).toContain('<mark>RESET</mark>')
    })

    it('should handle empty query', () => {
      const text = 'This is a message'
      const highlighted = highlightText(text, '')
      expect(highlighted).toBe(text)
    })

    it('should handle empty text', () => {
      const highlighted = highlightText('', 'password')
      expect(highlighted).toBe('')
    })

    it('should escape special regex characters', () => {
      const text = 'This is about password (reset)'
      const highlighted = highlightText(text, 'password (reset)')
      // Should not throw error and should highlight correctly
      expect(highlighted).toContain('<mark>password</mark>')
    })

    it('should highlight multiple occurrences', () => {
      const text = 'password reset and password again'
      const highlighted = highlightText(text, 'password')
      const matches = highlighted.match(/<mark>password<\/mark>/gi)
      expect(matches?.length).toBe(2)
    })
  })
})

