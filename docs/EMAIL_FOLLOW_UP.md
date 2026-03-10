# Email Follow-Up Work

This branch achieved its intended scope:

- Google OAuth sign-in
- Gmail import
- Encrypted local storage of imported mail

The items below are intentionally deferred to future branches.

## Gmail Writeback

- Send composed messages through Gmail when mirroring is enabled
- Send replies through Gmail and persist Gmail thread/message IDs
- Mirror delete or trash actions to Gmail when the user opts in
- Add conflict handling when local state and Gmail state diverge

## Persistence And Multi-User Hardening

- Move storage from local `.klar-data/` files to a real database
- Add a migration path for existing local records
- Add operational safeguards for multi-user deployments
- Add observability around auth, sync, and mail actions

## Sync Improvements

- Add incremental sync instead of full recent-message refreshes
- Add background sync jobs
- Add retry and backoff for Gmail API failures
- Add sync status details and failure surfacing in the UI

## Mail Model

- Add stronger thread and conversation modeling
- Persist attachments and attachment metadata
- Add richer reply metadata and Gmail header normalization
- Add sent, trash, and local-draft lifecycle states beyond the current prototype model

## Rendering

- Improve rich email rendering for complex multipart messages
- Support inline `cid:` images
- Improve attachment rendering and download flows
- Continue tuning the simple-versus-rich email classification heuristics

## Product Features

- Add search across imported mail
- Add better lens classification and indexing
- Add user settings for signatures, aliases, sync preferences, and account management
- Add production-ready account/session management UX

## Suggested Future Branches

1. `codex/gmail-writeback`
2. `codex/email-storage-db`
3. `codex/email-threading-and-search`
4. `codex/email-rendering-attachments`
