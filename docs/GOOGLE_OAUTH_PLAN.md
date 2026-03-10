# Google OAuth And Encrypted Gmail Import Plan

## Goal

Allow a user to sign in with Google, grant Gmail read access, import full emails into Klar, and store Gmail data encrypted at rest so downstream product features can run on locally cached mail instead of hitting Gmail for every interaction.

## Scope For This Branch

- Google OAuth start and callback flow
- Signed app session cookie
- Gmail read-only sync
- Local encrypted persistence layer inside the Next.js app backend
- UI hooks for sign-in, sync status, rendering full imported messages, and local mail actions

## Key Assumptions

- This repo does not have a database or separate backend service yet.
- The first implementation will use Next route handlers as the backend surface.
- Encrypted data will live in a local ignored directory (`.klar-data/`) as a development-safe placeholder for a real database.
- Production should move encrypted blobs and indexes into a managed database/object store, but the application code can keep the same logical interfaces.

## Architecture

### Auth

- `GET /api/auth/google/start`
  - Builds Google OAuth URL
  - Requests `openid`, `email`, `profile`, `https://www.googleapis.com/auth/gmail.readonly`
  - Stores CSRF state in an HttpOnly cookie
- `GET /api/auth/google/callback`
  - Verifies state
  - Exchanges code for tokens
  - Fetches Google profile
  - Encrypts OAuth tokens before persistence
  - Sets signed Klar session cookie

### Storage

- `users/<userId>.json`
  - non-sensitive metadata: id, email, display name, created timestamps
- `accounts/<userId>.json`
  - encrypted OAuth token payload
- `messages/<userId>.json`
  - encrypted Gmail messages, local Klar-only messages, and sync metadata
- `settings/<userId>.json`
  - encrypted mail behavior preferences such as future Gmail mirroring

### Encryption

- AES-256-GCM for payload encryption
- Keys loaded from environment
- Separate secrets for:
  - data encryption
  - cookie signing

### Gmail Sync

- `POST /api/email/sync`
  - validates session
  - refreshes access token if needed
  - pulls recent message IDs
  - fetches message details
  - normalizes full message payloads
  - merges Gmail imports with existing local Klar-only state
- `GET /api/email/list`
  - validates session
  - decrypts stored messages
  - returns full local mail records for the UI
- `GET /api/email/settings`
  - returns saved local mail preferences
- `POST /api/email/settings`
  - updates saved local mail preferences
- `POST /api/email/compose`
  - stores a local Klar sent message
- `POST /api/email/delete`
  - moves a message to Klar trash without touching Gmail

## Data Strategy

- Store full normalized message payload encrypted:
  - Gmail message id
  - thread id
  - labels
  - from
  - to / cc
  - subject
  - snippet
  - plain text body
  - html body when available
  - internal date
- Track local Klar state alongside imported Gmail data:
  - source (`gmail` or `local`)
  - mailbox (`inbox`, `sent`, `trash`)
  - reply linkage
  - local delete status
  - mirror preference marker for future Gmail writeback
- Keep only minimal unencrypted indexing metadata if needed for routing or sync bookkeeping.

## Security Notes

- Only read-only Gmail scope in this branch
- Refresh tokens encrypted at rest
- State cookie required for callback
- Session cookie signed and HttpOnly
- Local encrypted store ignored by git
- Local compose, reply, and delete do not mutate Gmail in this branch

## Next Step After This Branch

- Move persistence to a real database
- Add background incremental sync
- Add Gmail writeback for send/trash when the saved mirror preference is enabled
- Add per-user search/indexing and feature pipelines on decrypted server-side data
