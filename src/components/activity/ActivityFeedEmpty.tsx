'use client'

export function ActivityFeedEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-6xl mb-4">📭</div>
      <h3 className="text-lg font-semibold text-slate-200 mb-2">No activity yet</h3>
      <p className="text-sm text-slate-400 text-center max-w-md">
        Activity from tickets, rooms, and messages will appear here as they happen.
      </p>
    </div>
  )
}

