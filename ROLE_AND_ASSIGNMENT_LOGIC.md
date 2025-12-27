# Role and Assignment Logic Summary

## Overview

This document summarizes the role management, assignment, and participant addition logic for both **Rooms** (PUBLIC, PRIVATE) and **Issues/Tickets** (TICKET) in the system.

## Key Changes (Latest)

1. **Assign button removed** - Redundant with member list role management
2. **Admin permissions expanded** - Admins can now manage all member roles
3. **Unified role management** - All role changes happen through member list

---

## Room Roles Hierarchy

```
MEMBER (1) < MODERATOR (2) < OWNER (3)
```

### Role Permissions

| Role | Can Invite | Can Remove Members | Can Change Roles | Can Transfer Ownership | Can Edit Settings |
|------|------------|-------------------|------------------|----------------------|------------------|
| **MEMBER** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **MODERATOR** | ✅ | ❌ | ❌ | ❌ | ✅ (tags, type) |
| **OWNER** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ADMIN** | ✅ (any room) | ✅ (any room) | ✅ (any room) | ✅ (any room) | ✅ (any room) |

---

## Add Participant Functionality

### Who Can Add Participants

- **OWNER** - Can add participants to their rooms
- **MODERATOR** - Can add participants (even if not the owner)
- **ADMIN** - Can add participants to any room (even if not a member)

### How It Works

**Endpoint:** `POST /api/chat/rooms/[roomId]/invite`

1. **For Admins:**
   - Can invite to any room (PUBLIC, PRIVATE, TICKET)
   - Auto-added as MEMBER if not already a member
   - No membership check required

2. **For Non-Admins:**
   - Must be OWNER or MODERATOR of the room
   - Must be a member of the room

3. **Default Role:**
   - New participants are added as **MEMBER** by default
   - Can optionally be added as **MODERATOR** (via invite endpoint with `role: 'MODERATOR'`)

4. **Room Types:**
   - ✅ PUBLIC rooms - Can add participants
   - ✅ PRIVATE rooms - Can add participants
   - ✅ TICKET rooms - Can add participants

---

## Role Management (Member List)

### Available Actions

All role management happens through the **Member List** modal (👥 button).

#### 1. Promote to Moderator
- **Who can do it:** OWNER or ADMIN
- **Who can be promoted:** MEMBER users
- **Action:** Changes role from MEMBER → MODERATOR
- **Endpoint:** `PATCH /api/chat/rooms/[roomId]/members/[userId]` with `{ role: 'MODERATOR' }`

#### 2. Demote to Member
- **Who can do it:** OWNER or ADMIN
- **Who can be demoted:** MODERATOR users
- **Action:** Changes role from MODERATOR → MEMBER
- **Endpoint:** `PATCH /api/chat/rooms/[roomId]/members/[userId]` with `{ role: 'MEMBER' }`

#### 3. Transfer Ownership (Make Owner)
- **Who can do it:** OWNER or ADMIN
- **Who can be promoted:** Any member (MEMBER or MODERATOR)
- **Action:** 
  - Promotes target user to OWNER
  - Demotes all current owners to MODERATOR
  - Previous owner becomes MODERATOR
- **Endpoint:** `POST /api/chat/rooms/[roomId]/ownership` with `{ newOwnerId: userId }`

#### 4. Remove Member
- **Who can do it:** OWNER or ADMIN
- **Who can be removed:** MEMBER or MODERATOR (not OWNER)
- **Action:** Removes user from room entirely
- **Endpoint:** `DELETE /api/chat/rooms/[roomId]/members/[userId]`

### Restrictions

- ❌ Cannot change your own role
- ❌ Cannot change OWNER role directly (must use ownership transfer)
- ❌ Cannot set role to OWNER via PATCH (must use ownership transfer endpoint)
- ❌ Cannot remove the last OWNER if other members exist

---

## Assignment Logic (Removed)

### Previous Behavior (Now Removed)

The **Assign** button has been **removed** because it was redundant with member list functionality.

**Previous logic:**
- For TICKET rooms: Assigned user as OWNER (replaced current owner)
- For PUBLIC/PRIVATE rooms: Assigned user as MODERATOR

**Why removed:**
- Member list can already promote to OWNER (via "Make Owner" button)
- Member list can already promote to MODERATOR (via "Make Moderator" button)
- Add Participant already adds users as MEMBER
- No need for separate "Assign" flow

---

## Differences: Rooms vs Issues (Tickets)

### Rooms (PUBLIC, PRIVATE)

| Feature | Behavior |
|---------|----------|
| **Add Participant** | Adds as MEMBER (default) or MODERATOR (optional) |
| **Role Management** | Full role management via member list (MEMBER ↔ MODERATOR ↔ OWNER) |
| **Ownership** | Can transfer ownership, previous owner becomes MODERATOR |
| **Assign Button** | ❌ Removed (redundant) |

### Issues/Tickets (TICKET)

| Feature | Behavior |
|---------|----------|
| **Add Participant** | Adds as MEMBER (default) or MODERATOR (optional) |
| **Role Management** | Full role management via member list (MEMBER ↔ MODERATOR ↔ OWNER) |
| **Ownership** | Can transfer ownership, previous owner becomes MODERATOR |
| **Assign Button** | ❌ Removed (redundant) |
| **Special Note** | OWNER role represents "assigned to" for tickets |

### Key Similarity

**Both rooms and tickets now use the same unified role management system:**
1. Add Participant → Adds as MEMBER
2. Member List → Promote/Demote roles
3. Member List → Transfer ownership

---

## Admin Powers

Admins have **absolute power** in all rooms:

### What Admins Can Do

1. **Invite to any room** - Even if not a member
2. **Change any member's role** - MEMBER ↔ MODERATOR
3. **Transfer ownership** - In any room
4. **Remove members** - From any room
5. **View all tickets** - Even if not a member

### Admin Restrictions

- ❌ Cannot change their own role
- ❌ Cannot remove themselves
- ❌ Must use ownership transfer to set OWNER (same as regular users)

---

## API Endpoints Summary

### Add Participant
- **POST** `/api/chat/rooms/[roomId]/invite`
  - Body: `{ userId: string, role: 'MEMBER' | 'MODERATOR' }`
  - Permissions: OWNER, MODERATOR, or ADMIN

### Change Role
- **PATCH** `/api/chat/rooms/[roomId]/members/[userId]`
  - Body: `{ role: 'MEMBER' | 'MODERATOR' }`
  - Permissions: OWNER or ADMIN
  - Cannot set to OWNER (use ownership transfer)

### Transfer Ownership
- **POST** `/api/chat/rooms/[roomId]/ownership`
  - Body: `{ newOwnerId: string }`
  - Permissions: OWNER or ADMIN
  - Demotes all current owners to MODERATOR

### Remove Member
- **DELETE** `/api/chat/rooms/[roomId]/members/[userId]`
  - Permissions: OWNER or ADMIN
  - Cannot remove OWNER if they're the last owner

---

## User Flow Examples

### Example 1: Adding a Participant to a Room

1. User clicks **"➕ Add Participant"** button
2. Searches for user (current user filtered out)
3. Selects user
4. User is added as **MEMBER** by default
5. If needed, OWNER/ADMIN can promote to MODERATOR via member list

### Example 2: Promoting a Member to Owner

1. User clicks **"👥 Members"** button
2. Finds member in list
3. Clicks **"Make Owner"** button
4. Previous owner is demoted to MODERATOR
5. Selected member becomes OWNER

### Example 3: Admin Managing a Room

1. Admin opens any room (even if not a member)
2. Admin can add participants
3. Admin can view member list
4. Admin can change any member's role
5. Admin can transfer ownership
6. Admin can remove members

---

## Current State

✅ **Unified System:** Rooms and tickets use the same role management
✅ **No Redundancy:** Assign button removed, member list handles everything
✅ **Admin Power:** Admins can manage all rooms
✅ **Clear Permissions:** Each role has well-defined permissions
✅ **Safe Operations:** Prevents dangerous operations (removing last owner, etc.)

---

## Notes

- **External customers** can only access their own tickets (no admin override)
- **Internal users/admins** can access tickets if they're members OR if they're admins
- All role changes are logged in the audit log
- Role hierarchy is enforced (OWNER > MODERATOR > MEMBER)

