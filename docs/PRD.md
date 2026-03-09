# Product Requirements Document (PRD): Klar

- **Product Name:** Klar
- **Document Version:** 1.2
- **Status:** Concept / Prototyping Phase

## 1. Executive Summary

Klar is a minimalist, AI-powered productivity platform designed to serve as a **personal operating system**. Its primary goal is to reduce digital overwhelm by transforming the chaotic, traditional inbox into a calm, structured **Nagare** stream (Japanese for “continuous flow”).

By combining high-end, shibui-inspired design with powerful LLM integrations (Gemini), Klar works like a **tabula rasa**: lowering cognitive load and helping users focus on one task at a time.

## 2. Core Philosophy & Design Principles

### 2.1 Principle of Ma (間 — Negative Space)

Cognitive load reduction is paramount.

- The UI should aggressively hide non-essential information.
- Empty space should be treated as functional design, allowing users room to think until data is explicitly needed.

### 2.2 Shibui Aesthetic

The visual language should feel subtle, elegant, and unobtrusive.

- Soft typography
- High-transparency overlays
- Expansive whitespace
- Physical-feeling transitions (blur, fade, scale)

### 2.3 Panta Rhei (Everything Flows)

Temporal over spatial organization.

- Information is grouped by time instead of static folders.
- This mirrors how memory naturally processes events.

### 2.4 Kuroko (黒衣 — Invisible Stagehands) Intelligence

AI should feel assistive, not performative.

- The system quietly arranges context in the background.
- AI guidance must offer clarity without dominating the interface.

## 3. Target Audience

### 3.1 Freelancers & Solopreneurs

Need a single workspace for multiple client streams and projects.

### 3.2 Creators & Designers

Value aesthetic quality and become distracted by visually noisy tools.

### 3.3 Executives & Managers

Handle high-volume inbound communication and require rapid triage.

## 4. Key Features & Requirements

### 4.1 The Nagare Stream (Inbox)

A single-column, chronological timeline of inbound communication and tasks.

**Requirements**

- Group items under elegant temporal dividers:
  - **Hodie** (Today)
  - **Heri** (Yesterday)
  - **Olim** (Earlier)
- Support infinite scrolling (incremental rendering) for thousands of items.
- Use skeleton loaders (soft pulsing neutral blocks) instead of spinners.
- In collapsed state, show only:
  - Sender
  - Subject
  - Time
  - Brief muted preview

### 4.2 Zanshin (残心) Focus Mode

An interaction model for sustained attention on a single item.

**Requirements**

- Clicking an item expands it inline with smooth animation.
- The selected item subtly elevates (shadow + slight scale increase).
- All non-selected items must immediately:
  - Blur
  - Fade opacity
  - Scale down slightly
- Expanded state must include quick actions:
  - Mark Done
  - Reply
  - Dismiss

### 4.3 Prisma Lenses (Filtering)

Icon-based filters that act as viewing lenses.

**Requirements**

- Lens categories:
  - **Omnis** (All)
  - **Opus** (Work)
  - **Fiscus** (Finance)
  - **Vita** (Life)
  - **Systema** (System)
- Lens switching must be smooth and correctly filter the stream.
- Lens icons should use soft category color accents (fully activated only when selected).

### 4.4 Shizukana (Quiet) AI Integrations (Gemini 2.5)

#### 4.4.1 Satori Briefing

A contextual Inbox action that analyzes the currently filtered set.

**Output requirement**

- A concise paragraph, **maximum 40 words**, providing tactical guidance.
- Example: “Focus on Q4 logistics today; the rest can wait.”

#### 4.4.2 Smart Draft

Available in Zanshin mode for individual items.

**Behavior**

- Draft short, professional replies using sender and subject context.

#### 4.4.3 Karakuri Engine (Agent Lab)

A dedicated natural-language command workspace.

**Behavior**

- Users enter commands (e.g., “Extract all Q4 dates from my work emails”).
- Gemini interprets and executes multi-step workflows.

### 4.5 Omnis Palette (Command Palette)

A global search and navigation overlay triggered via **Cmd/Ctrl + K**.

**Requirements**

- Overlay uses a high-blur backdrop.
- Supports fast navigation to:
  - Prisma Lenses
  - Inbox
  - Projects
  - Agents
- Prioritize typography-first UX (large serif input, low chrome).

## 5. Technical Architecture & Stack

To achieve fluid animation and data scalability:

- **Frontend:** Next.js (App Router) + React
- **Language:** TypeScript (strict mode)
- **Styling & motion:** Tailwind CSS + Framer Motion
- **Data & caching:** TanStack Query (infinite scroll caching)
- **Virtualization:** TanStack Virtual
- **Backend & DB:** Supabase (PostgreSQL + realtime subscriptions)
- **AI integration:** Vercel AI SDK with secure Gemini API calls through Next.js server actions

## 6. Future Roadmap (Post-v1.0)

### 6.1 Atelier Module

Expand Projects into visual workspaces where users can drag-and-drop items from Nagare.

### 6.2 External Integrations

Allow Karakuri agents to trigger actions in external tools (calendar events, Jira updates, etc.).

### 6.3 Mobile Applications

Translate Zanshin focus interactions into native gesture systems for iOS and Android.
