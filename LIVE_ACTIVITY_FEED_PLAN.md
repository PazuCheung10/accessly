# Live Activity Feed - Design Plan

## Overview
A minimal Live Activity Feed that displays chronological events from tickets, rooms, and messages without requiring schema changes. The feed aggregates data from existing tables and normalizes them into a unified event format.

---

## 1. Event Sources & Data Mapping

### 1.1 Ticket Created
**Source**: `Room` table
- **Filter**: `type = 'TICKET'`
- **Timestamp**: `Room.createdAt`
- **Actor**: `Room.creatorId` → `User` (via relation)
- **Target**: `Room.id`, `Room.title`
- **Metadata**: 
  - `roomId`: Room.id
  - `roomTitle`: Room.title
  - `ticketDepartment`: Room.ticketDepartment
  - `status`: Room.status (initial status, typically 'OPEN')

**Query Strategy**:
```typescript
// Fetch ticket rooms ordered by createdAt
prisma.room.findMany({
  where: { type: 'TICKET' },
  orderBy: { createdAt: 'desc' },
  include: { creator: { select: { id, name, email, image } } },
  take: limit
})
```

---

### 1.2 Ticket Status Changed
**Source**: `AuditLog` table
- **Filter**: `action = 'ticket.status.change'`
- **Timestamp**: `AuditLog.createdAt`
- **Actor**: `AuditLog.actorId` → `User` (via relation)
- **Target**: `AuditLog.targetId` (roomId)
- **Metadata**: 
  - `oldStatus`: from `AuditLog.metadata.oldStatus`
  - `newStatus`: from `AuditLog.metadata.newStatus`
  - `ticketTitle`: from `AuditLog.metadata.ticketTitle`
  - `roomId`: `AuditLog.targetId`

**Query Strategy**:
```typescript
// Already indexed on createdAt (desc) and targetType/targetId
prisma.auditLog.findMany({
  where: { action: 'ticket.status.change' },
  orderBy: { createdAt: 'desc' },
  include: { actor: { select: { id, name, email, image } } },
  take: limit
})
```

---

### 1.3 Ticket Assigned
**Source**: `AuditLog` table (if logged) OR `RoomMember` table (inferred)

**Option A - If audit logging exists**:
- **Filter**: `action = 'ticket.assign'` (or similar)
- **Timestamp**: `AuditLog.createdAt`
- **Actor**: `AuditLog.actorId` → `User`
- **Target**: `AuditLog.targetId` (roomId)
- **Metadata**: 
  - `assignedToUserId`: from `AuditLog.metadata.assignedToUserId`
  - `assignedToName`: resolved from User lookup
  - `roomId`: `AuditLog.targetId`

**Option B - If NOT logged (current state)**:
- **Source**: `RoomMember` table
- **Challenge**: No timestamp on role changes
- **Workaround**: Cannot reliably track assignment time without schema changes
- **Recommendation**: Add audit logging to `/api/tickets/[ticketId]/assign` endpoint (code change, not schema change)

**Query Strategy** (if audit logged):
```typescript
prisma.auditLog.findMany({
  where: { action: 'ticket.assign' },
  orderBy: { createdAt: 'desc' },
  include: { actor: { select: { id, name, email, image } } },
  take: limit
})
```

**Note**: Currently, ticket assignment is NOT logged. We need to add `logAction('ticket.assign', ...)` to the assign endpoint.

---

### 1.4 Room Created
**Source**: `Room` table
- **Filter**: `type IN ('PUBLIC', 'PRIVATE')` (exclude TICKET and DM)
- **Timestamp**: `Room.createdAt`
- **Actor**: `Room.creatorId` → `User` (via relation)
- **Target**: `Room.id`, `Room.title`
- **Metadata**:
  - `roomId`: Room.id
  - `roomTitle`: Room.title
  - `roomType`: Room.type
  - `isPrivate`: Room.isPrivate

**Query Strategy**:
```typescript
prisma.room.findMany({
  where: { 
    type: { in: ['PUBLIC', 'PRIVATE'] },
    creatorId: { not: null }
  },
  orderBy: { createdAt: 'desc' },
  include: { creator: { select: { id, name, email, image } } },
  take: limit
})
```

---

### 1.5 Message Posted
**Source**: `Message` table
- **Filter**: `deletedAt IS NULL` (exclude deleted messages)
- **Timestamp**: `Message.createdAt`
- **Actor**: `Message.userId` → `User` (via relation)
- **Target**: `Message.roomId` → `Room`
- **Metadata**:
  - `messageId`: Message.id
  - `roomId`: Message.roomId
  - `roomTitle`: Room.title (via join)
  - `roomType`: Room.type
  - `content`: Message.content (truncated for preview)
  - `isThreadReply`: `Message.parentMessageId !== null`

**Query Strategy**:
```typescript
prisma.message.findMany({
  where: { deletedAt: null },
  orderBy: { createdAt: 'desc' },
  include: {
    user: { select: { id, name, email, image } },
    room: { select: { id, title, type } }
  },
  take: limit
})
```

---

## 2. Event Normalization

### 2.1 Unified Event Type
```typescript
type ActivityEventType = 
  | 'ticket.created'
  | 'ticket.status.changed'
  | 'ticket.assigned'
  | 'room.created'
  | 'message.posted'

interface ActivityEvent {
  id: string                    // Unique ID (source table ID + prefix)
  type: ActivityEventType
  timestamp: Date               // Normalized timestamp
  actor: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
  target: {
    id: string                 // roomId, ticketId, messageId
    title?: string             // Room/ticket title
    type?: string              // Room type, ticket department, etc.
  }
  metadata: {
    // Event-specific data
    [key: string]: any
  }
  source: 'audit' | 'room' | 'message'  // Source table for debugging
  sourceId: string             // Original record ID
}
```

### 2.2 Normalization Logic

**From AuditLog**:
```typescript
function normalizeAuditLog(log: AuditLog): ActivityEvent {
  const eventType = mapAuditActionToEventType(log.action)
  return {
    id: `audit-${log.id}`,
    type: eventType,
    timestamp: log.createdAt,
    actor: log.actor,
    target: {
      id: log.targetId || '',
      title: log.metadata?.ticketTitle || null,
    },
    metadata: log.metadata || {},
    source: 'audit',
    sourceId: log.id,
  }
}

function mapAuditActionToEventType(action: string): ActivityEventType {
  switch (action) {
    case 'ticket.status.change': return 'ticket.status.changed'
    case 'ticket.assign': return 'ticket.assigned'
    default: return null // Filter out unmapped actions
  }
}
```

**From Room**:
```typescript
function normalizeRoom(room: Room, eventType: 'ticket.created' | 'room.created'): ActivityEvent {
  return {
    id: `room-${room.id}`,
    type: eventType,
    timestamp: room.createdAt,
    actor: room.creator || { id: '', name: null, email: null, image: null },
    target: {
      id: room.id,
      title: room.title,
      type: room.type,
    },
    metadata: {
      roomId: room.id,
      roomTitle: room.title,
      ...(room.type === 'TICKET' && {
        ticketDepartment: room.ticketDepartment,
        status: room.status,
      }),
      ...(room.type !== 'TICKET' && {
        roomType: room.type,
        isPrivate: room.isPrivate,
      }),
    },
    source: 'room',
    sourceId: room.id,
  }
}
```

**From Message**:
```typescript
function normalizeMessage(message: Message): ActivityEvent {
  return {
    id: `message-${message.id}`,
    type: 'message.posted',
    timestamp: message.createdAt,
    actor: message.user,
    target: {
      id: message.roomId,
      title: message.room?.title || null,
      type: message.room?.type || null,
    },
    metadata: {
      messageId: message.id,
      roomId: message.roomId,
      content: message.content.substring(0, 100), // Truncate for preview
      isThreadReply: message.parentMessageId !== null,
    },
    source: 'message',
    sourceId: message.id,
  }
}
```

---

## 3. Data Aggregation Strategy

### 3.1 Multi-Source Query Approach

**Option A: Parallel Queries + Merge (Recommended)**
1. Query each source independently with same limit
2. Merge results in memory
3. Sort by timestamp descending
4. Take top N items

**Pros**:
- Uses existing indexes efficiently
- Can optimize each query independently
- Simple to implement

**Cons**:
- May fetch more data than needed (e.g., 50 from each = 250 total, then take 50)
- Multiple database round trips

**Implementation**:
```typescript
async function fetchActivityFeed(limit: number = 50) {
  // Fetch from all sources in parallel
  const [auditLogs, ticketRooms, regularRooms, messages] = await Promise.all([
    // Audit logs (status changes, assignments)
    prisma.auditLog.findMany({
      where: {
        action: { in: ['ticket.status.change', 'ticket.assign'] }
      },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id, name, email, image } } },
      take: limit,
    }),
    
    // Ticket rooms (ticket created)
    prisma.room.findMany({
      where: { type: 'TICKET' },
      orderBy: { createdAt: 'desc' },
      include: { creator: { select: { id, name, email, image } } },
      take: limit,
    }),
    
    // Regular rooms (room created)
    prisma.room.findMany({
      where: {
        type: { in: ['PUBLIC', 'PRIVATE'] },
        creatorId: { not: null }
      },
      orderBy: { createdAt: 'desc' },
      include: { creator: { select: { id, name, email, image } } },
      take: limit,
    }),
    
    // Messages (message posted)
    prisma.message.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id, name, email, image } },
        room: { select: { id, title, type } }
      },
      take: limit,
    }),
  ])
  
  // Normalize and merge
  const events: ActivityEvent[] = [
    ...auditLogs.map(normalizeAuditLog),
    ...ticketRooms.map(r => normalizeRoom(r, 'ticket.created')),
    ...regularRooms.map(r => normalizeRoom(r, 'room.created')),
    ...messages.map(normalizeMessage),
  ]
  
  // Sort by timestamp descending
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  
  // Return top N
  return events.slice(0, limit)
}
```

**Option B: Single Union Query (Complex)**
- Use SQL UNION to combine all sources
- Requires complex type casting and null handling
- Not recommended for Prisma

---

## 4. API Endpoint Design

### 4.1 Endpoint: `GET /api/activity/feed`

**Query Parameters**:
- `limit` (optional, default: 50, max: 200): Number of events to return
- `cursor` (optional): Cursor for pagination (event ID)
- `types` (optional): Comma-separated event types to filter (e.g., `ticket.created,message.posted`)

**Response**:
```typescript
{
  ok: true,
  data: {
    events: ActivityEvent[],
    cursor: string | null,  // Last event ID for pagination
    hasMore: boolean,
  }
}
```

**Pagination Strategy**:
- Use cursor-based pagination with event ID
- For next page: filter events where `timestamp < lastEvent.timestamp` OR `(timestamp === lastEvent.timestamp AND id < lastEvent.id)`
- This ensures consistent ordering across multiple sources

---

## 5. UI Component Design

### 5.1 Component Structure
```
ActivityFeed/
  ├── ActivityFeed.tsx          # Main container component
  ├── ActivityFeedItem.tsx      # Individual event item
  └── ActivityFeedEmpty.tsx    # Empty state
```

### 5.2 ActivityFeedItem Props
```typescript
interface ActivityFeedItemProps {
  event: ActivityEvent
}
```

### 5.3 Event Rendering Logic

**Ticket Created**:
```
[Icon] {actor.name} created ticket "{target.title}"
       {relativeTimestamp}
```

**Ticket Status Changed**:
```
[Icon] {actor.name} changed ticket "{target.title}" status from {oldStatus} to {newStatus}
       {relativeTimestamp}
```

**Ticket Assigned**:
```
[Icon] {actor.name} assigned ticket "{target.title}" to {assignedToName}
       {relativeTimestamp}
```

**Room Created**:
```
[Icon] {actor.name} created room "{target.title}"
       {relativeTimestamp}
```

**Message Posted**:
```
[Icon] {actor.name} posted in "{target.title}": "{content preview}"
       {relativeTimestamp}
```

### 5.4 Relative Timestamp Format
- Use library like `date-fns` or `dayjs`
- Format: "2 minutes ago", "1 hour ago", "3 days ago", "Jan 15, 2024" (if > 7 days)

### 5.5 UI Layout
- Vertical scrollable list
- Each item: avatar, event text, timestamp
- Simple card/row design
- Hover states for interactivity
- Click to navigate to related entity (room, ticket, message)

---

## 6. Implementation Checklist

### Phase 1: Backend
- [ ] Create `/api/activity/feed` endpoint
- [ ] Implement `normalizeAuditLog()` function
- [ ] Implement `normalizeRoom()` function
- [ ] Implement `normalizeMessage()` function
- [ ] Implement `fetchActivityFeed()` aggregation logic
- [ ] Add cursor-based pagination
- [ ] Add audit logging to ticket assignment endpoint (if missing)

### Phase 2: Frontend
- [ ] Create `ActivityFeed` component
- [ ] Create `ActivityFeedItem` component
- [ ] Implement relative timestamp formatting
- [ ] Add event type icons
- [ ] Add navigation to related entities
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add empty state

### Phase 3: Integration
- [ ] Add Activity Feed to dashboard or dedicated page
- [ ] Test with real data
- [ ] Verify chronological ordering
- [ ] Test pagination
- [ ] Performance testing (query optimization if needed)

---

## 7. Performance Considerations

### 7.1 Query Optimization
- All source queries use existing indexes:
  - `AuditLog.createdAt` (desc) - indexed
  - `Room.createdAt` - indexed
  - `Message.createdAt` (desc) - indexed on `[roomId, createdAt]`
- Limit each source query to prevent over-fetching
- Consider adding composite index on `Message.createdAt` if not exists

### 7.2 Caching Strategy (Future)
- Cache feed results for 30-60 seconds
- Invalidate on new events (via webhooks or polling)
- Use React Query or SWR for client-side caching

### 7.3 Pagination Limits
- Default: 50 events
- Max: 200 events per request
- Prevent excessive data transfer

---

## 8. Edge Cases & Considerations

### 8.1 Missing Data
- **Null creator**: Handle rooms/messages with `creatorId = null`
- **Deleted users**: Use fallback display ("Unknown User")
- **Deleted rooms**: Filter out or show "Deleted Room"

### 8.2 Ticket Assignment Tracking
- **Current state**: Not logged in audit
- **Solution**: Add `logAction('ticket.assign', ...)` to assign endpoint
- **Alternative**: Skip assignment events if not critical for MVP

### 8.3 Message Threads
- Show thread replies as regular messages
- Optionally group by parent message (future enhancement)

### 8.4 Privacy & Access Control
- Filter events based on user permissions:
  - Only show messages from rooms user has access to
  - Only show tickets user is member of (or is admin)
  - Only show rooms user can see
- Apply RBAC filters in API endpoint

---

## 9. Future Enhancements (Out of Scope)

- Real-time updates via WebSocket
- Event filtering by type
- Event search
- Grouping related events (e.g., multiple messages in same room)
- Event details modal
- Export activity feed
- Activity feed for specific user/room/ticket

---

## 10. File Structure

```
src/
  app/
    api/
      activity/
        feed/
          route.ts              # GET /api/activity/feed
  lib/
    activity/
      normalize.ts              # Normalization functions
      types.ts                  # ActivityEvent types
  components/
    activity/
      ActivityFeed.tsx          # Main feed component
      ActivityFeedItem.tsx     # Individual event item
      ActivityFeedEmpty.tsx    # Empty state
```

---

## Summary

This plan provides a minimal Live Activity Feed that:
1. ✅ Aggregates events from existing tables (AuditLog, Room, Message)
2. ✅ Normalizes events into unified format
3. ✅ Renders chronologically with relative timestamps
4. ✅ Uses simple vertical feed UI
5. ✅ No schema changes required (may need to add audit logging for ticket assignment)

The implementation is straightforward and leverages existing database indexes for performance.

