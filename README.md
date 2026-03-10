# Klar

Klar is a minimalist, AI-powered productivity concept focused on reducing digital overwhelm through a calm, temporal stream experience.

## Prototype Included

This repository now includes an interactive Next.js prototype for:

- Nagare Stream grouped by Today / Yesterday / Earlier
- Prisma Lenses filtering
- Zanshin Focus Mode inline expansion and dimming of non-selected items
- Satori Briefing (mocked guidance)
- Karakuri Engine command input
- Omnis Palette overlay via `Cmd/Ctrl + K`
- Gmail import with full readable message bodies stored encrypted at rest
- Local-first compose, reply, and delete-to-trash actions inside Klar
- Saved mirror-to-Gmail preference for future writeback support

## Run Locally

```bash
nvm use
npm install
npm run dev
```

Then open `http://localhost:3000`.
This repo targets Node 24 LTS.

## Google OAuth Setup

Copy `.env.example` to `.env.local` and set:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `KLAR_ENCRYPTION_KEY`
- `KLAR_SESSION_SECRET`

Notes:

- Use a 32-byte base64 value for `KLAR_ENCRYPTION_KEY` and `KLAR_SESSION_SECRET`.
- Configure the Google OAuth redirect URI to `http://localhost:3000/api/auth/google/callback`.
- Imported Gmail data is stored encrypted in the local ignored `.klar-data/` directory in this branch.
- Compose, reply, and delete are intentionally local-only right now; Gmail remains unchanged.
- The mirror-to-Gmail setting only saves user preference in this branch. Actual Gmail writeback is not implemented yet.

## Product Spec

- `docs/PRD.md`: Product Requirements Document (v1.2).
