'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Ticket {
  id: string
  roomId: string // Explicitly include roomId (same as id, but makes it clear)
  name: string
  title: string
  description: string | null
  status: 'OPEN' | 'WAITING' | 'RESOLVED' | null
  department: string | null
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    name: string | null
    email: string | null
  } | null
  owner: {
    id: string
    name: string | null
    email: string | null
  } | null
  firstMessage: {
    id: string
    content: string
    createdAt: string
    user: {
      id: string
      name: string | null
      email: string | null
    }
  } | null
  messageCount: number
}

interface TicketsListProps {
  showCreateButton?: boolean
}

export function TicketsList({ showCreateButton = false }: TicketsListProps) {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'WAITING' | 'RESOLVED' | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: 'GENERAL' as 'IT_SUPPORT' | 'BILLING' | 'PRODUCT' | 'GENERAL' | '',
    assignToUserId: '' as string | '',
  })

  useEffect(() => {
    fetchTickets()
  }, [statusFilter])

  const fetchTickets = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (statusFilter) {
        params.set('status', statusFilter)
      }
      const response = await fetch(`/api/tickets?${params.toString()}`)
      const data = await response.json()

      if (data.ok && data.data?.tickets) {
        setTickets(data.data.tickets)
      }
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setIsCreating(true)

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          department: formData.department || null,
          assignToUserId: formData.assignToUserId || null,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Failed to create issue')
      }

      // Reset form and close modal
      setFormData({
        title: '',
        description: '',
        department: 'GENERAL',
        assignToUserId: '',
      })
      setShowCreateModal(false)
      
      // Refresh tickets list
      await fetchTickets()
      
      // Navigate to the new issue
      if (data.data?.ticketId) {
        router.push(`/chat?room=${data.data.ticketId}`)
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create issue')
    } finally {
      setIsCreating(false)
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'OPEN':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'WAITING':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'RESOLVED':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  const getDepartmentLabel = (department: string | null) => {
    if (!department) return 'General'
    switch (department) {
      case 'IT_SUPPORT':
        return 'IT Support'
      case 'BILLING':
        return 'Billing'
      case 'PRODUCT':
        return 'Product'
      case 'GENERAL':
        return 'General'
      default:
        return department
    }
  }

  const getDepartmentColor = (department: string | null) => {
    switch (department) {
      case 'IT_SUPPORT':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'BILLING':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'PRODUCT':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'GENERAL':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  // Clean title by removing department prefix like [TICKET][Security] or [Security]
  const cleanTitle = (title: string) => {
    // Remove [TICKET][Department] or [Department] prefix
    return title.replace(/^\[TICKET\]\[[^\]]+\]\s*/, '').replace(/^\[TICKET\]\s*/, '').replace(/^\[[^\]]+\]\s*/, '').trim()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading tickets...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Create Issue Button */}
      {showCreateButton && (
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors font-medium"
          >
            + Create New Issue
          </button>
        </div>
      )}

      {/* Create Issue Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create New Issue</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setCreateError(null)
                  setFormData({
                    title: '',
                    description: '',
                    department: 'GENERAL',
                    assignToUserId: '',
                  })
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateIssue} className="space-y-4">
              {createError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                  {createError}
                </div>
              )}

              <div>
                <label htmlFor="title" className="block text-sm font-medium mb-2 text-slate-300">
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="Brief description of the issue"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-2 text-slate-300">
                  Description *
                </label>
                <textarea
                  id="description"
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
                  placeholder="Detailed description of the issue..."
                />
              </div>

              <div>
                <label htmlFor="department" className="block text-sm font-medium mb-2 text-slate-300">
                  Department (Optional)
                </label>
                <select
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value as any })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <option value="">None</option>
                  <option value="IT_SUPPORT">IT Support</option>
                  <option value="BILLING">Billing</option>
                  <option value="PRODUCT">Product</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateError(null)
                    setFormData({
                      title: '',
                      description: '',
                      department: 'GENERAL',
                      assignToUserId: '',
                    })
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !formData.title.trim() || !formData.description.trim()}
                  className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Create Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-4 py-2 rounded-lg transition-colors ${
            statusFilter === null
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setStatusFilter('OPEN')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            statusFilter === 'OPEN'
              ? 'bg-green-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Open
        </button>
        <button
          onClick={() => setStatusFilter('WAITING')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            statusFilter === 'WAITING'
              ? 'bg-yellow-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Waiting
        </button>
        <button
          onClick={() => setStatusFilter('RESOLVED')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            statusFilter === 'RESOLVED'
              ? 'bg-slate-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Resolved
        </button>
      </div>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
          <p className="text-slate-400">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/chat?room=${ticket.id}`}
              className="block bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{cleanTitle(ticket.title)}</h3>
                    {ticket.department && (
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded border ${getDepartmentColor(ticket.department)}`}
                      >
                        {getDepartmentLabel(ticket.department)}
                      </span>
                    )}
                    <span
                      className={`px-2 py-1 text-xs rounded border ${getStatusColor(ticket.status)}`}
                    >
                      {ticket.status || 'OPEN'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 mb-2">
                    From: {ticket.creator?.name || ticket.creator?.email || 'Unknown'} ({ticket.creator?.email})
                    {ticket.owner && (
                      <span className="ml-4">
                        Assigned to: {ticket.owner.name || ticket.owner.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              {ticket.firstMessage && (
                <div className="bg-slate-900/50 rounded p-3 mb-3">
                  <p className="text-sm text-slate-300 line-clamp-2">
                    {ticket.firstMessage.content}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{ticket.messageCount} {ticket.messageCount === 1 ? 'message' : 'messages'}</span>
                <span>Updated {new Date(ticket.updatedAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

