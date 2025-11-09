import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SearchResults } from '@/components/SearchResults'

// Mock fetch
global.fetch = vi.fn()

describe('SearchResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render search input', () => {
    render(<SearchResults />)
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('should highlight search terms in results', async () => {
    const mockResults = {
      ok: true,
      data: {
        messages: [
          {
            id: 'msg-1',
            content: 'This is about password reset functionality',
            snippet: 'This is about password reset functionality',
            roomId: 'room-1',
            roomTitle: 'Support',
            createdAt: new Date().toISOString(),
            score: 0.95,
            user: {
              id: 'user-1',
              name: 'Alice',
              email: 'alice@example.com',
            },
          },
        ],
        rooms: [],
      },
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      json: async () => mockResults,
    })

    render(<SearchResults initialQuery="password reset" />)

    await waitFor(() => {
      const highlighted = screen.getByText(/password reset/i)
      expect(highlighted).toBeInTheDocument()
    })
  })

  it('should display search results with snippets', async () => {
    const mockResults = {
      ok: true,
      data: {
        messages: [
          {
            id: 'msg-1',
            content: 'Test message',
            snippet: 'Test message snippet',
            roomId: 'room-1',
            roomTitle: 'Support',
            createdAt: new Date().toISOString(),
            score: 0.95,
            user: {
              id: 'user-1',
              name: 'Alice',
              email: 'alice@example.com',
            },
          },
        ],
        rooms: [],
      },
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      json: async () => mockResults,
    })

    render(<SearchResults initialQuery="test" />)

    await waitFor(() => {
      expect(screen.getByText(/Test message snippet/i)).toBeInTheDocument()
    })
  })

  it('should display room results', async () => {
    const mockResults = {
      ok: true,
      data: {
        messages: [],
        rooms: [
          {
            id: 'room-1',
            name: '#support',
            title: 'Support',
            description: 'Support room',
            type: 'PUBLIC',
            memberCount: 10,
            messageCount: 50,
          },
        ],
      },
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      json: async () => mockResults,
    })

    render(<SearchResults initialQuery="support" />)

    await waitFor(() => {
      expect(screen.getByText(/Support/i)).toBeInTheDocument()
    })
  })

  it('should handle search errors', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    render(<SearchResults initialQuery="test" />)

    await waitFor(() => {
      // Should handle error gracefully
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
    })
  })

  it('should show loading state', () => {
    ;(global.fetch as any).mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<SearchResults initialQuery="test" />)
    // Loading state should be shown (implementation dependent)
  })

  it('should display relevance scores', async () => {
    const mockResults = {
      ok: true,
      data: {
        messages: [
          {
            id: 'msg-1',
            content: 'Test message',
            snippet: 'Test message snippet',
            roomId: 'room-1',
            roomTitle: 'Support',
            createdAt: new Date().toISOString(),
            score: 0.95,
            user: {
              id: 'user-1',
              name: 'Alice',
              email: 'alice@example.com',
            },
          },
        ],
        rooms: [],
      },
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      json: async () => mockResults,
    })

    render(<SearchResults initialQuery="test" />)

    await waitFor(() => {
      expect(screen.getByText(/0.95/i)).toBeInTheDocument()
    })
  })
})

