"use client";

import { AnimatePresence, motion } from "framer-motion";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmailHtml from "@/components/EmailHtml";
import { bucketLabels, streamItems } from "@/lib/data";
import type { ImportedMessage, Lens, MailSettings, Mailbox, StreamItem } from "@/lib/types";

const lenses: Array<{ id: Lens; label: string; color: string }> = [
  { id: "omnis", label: "All", color: "text-slate-600" },
  { id: "opus", label: "Work", color: "text-blue-500" },
  { id: "fiscus", label: "Finance", color: "text-emerald-500" },
  { id: "vita", label: "Life", color: "text-violet-500" },
  { id: "systema", label: "System", color: "text-amber-500" }
];

const mailboxViews: Array<{ id: Mailbox; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "sent", label: "Sent" },
  { id: "trash", label: "Trash" }
];

type ThemeMode = "light" | "dark";

type SessionState = {
  loading: boolean;
  authenticated: boolean;
  googleConfigured: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    lastSyncedAt: string | null;
  } | null;
  messageCount: number;
};

type ComposerState = {
  open: boolean;
  to: string;
  cc: string;
  subject: string;
  bodyText: string;
  replyToMessageId: string | null;
};

const defaultSessionState: SessionState = {
  loading: true,
  authenticated: false,
  googleConfigured: false,
  user: null,
  messageCount: 0
};

const defaultComposerState: ComposerState = {
  open: false,
  to: "",
  cc: "",
  subject: "",
  bodyText: "",
  replyToMessageId: null
};

const defaultMailSettings: MailSettings = {
  mirrorActionsToGmail: false
};

function resolveTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem("klar-theme");
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function classifyLens(message: ImportedMessage): Exclude<Lens, "omnis"> {
  const haystack = `${message.subject} ${message.snippet} ${message.from} ${message.to.join(" ")}`.toLowerCase();

  if (/(invoice|receipt|payment|bank|tax|statement|billing|payroll)/.test(haystack)) {
    return "fiscus";
  }

  if (/(security|sign-in|verification|alert|password|system|no-reply|noreply)/.test(haystack)) {
    return "systema";
  }

  if (/(dinner|trip|family|friend|reservation|party|school|weekend)/.test(haystack)) {
    return "vita";
  }

  return "opus";
}

function parseMessageDate(value: string) {
  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    return new Date(Number(trimmed));
  }

  return new Date(trimmed);
}

function toBucketLabel(value: string) {
  const date = parseMessageDate(value);
  if (Number.isNaN(date.getTime())) return "olim" as const;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (target.getTime() === today.getTime()) return "hodie" as const;
  if (target.getTime() === yesterday.getTime()) return "heri" as const;
  return "olim" as const;
}

function toTimeLabel(value: string) {
  const date = parseMessageDate(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const bucket = toBucketLabel(value);

  if (bucket === "hodie") {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  if (bucket === "heri") {
    return "Yesterday";
  }

  return date.toLocaleDateString([], { weekday: "short" });
}

function toFullDateLabel(value: string) {
  const date = parseMessageDate(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function toSender(value: string) {
  const match = value.match(/^(.*?)\s*</);
  return match?.[1]?.trim() || value;
}

function toStreamItems(messages: ImportedMessage[]): StreamItem[] {
  return messages.map((message) => ({
    id: message.id,
    sender: toSender(message.from),
    subject: message.subject,
    preview: message.snippet || message.bodyText.slice(0, 140) || "No preview available.",
    time: toTimeLabel(message.internalDate),
    bucket: toBucketLabel(message.internalDate),
    lens: classifyLens(message)
  }));
}

function joinAddresses(addresses: string[]) {
  return addresses.length > 0 ? addresses.join(", ") : "None";
}

function ensureReplySubject(subject: string) {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

function createReplyDraft(message: ImportedMessage) {
  const quotedBody = message.bodyText
    ? `\n\nOn ${toFullDateLabel(message.internalDate)}, ${toSender(message.from)} wrote:\n${message.bodyText
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}`
    : "";

  return {
    open: true,
    to: message.from,
    cc: "",
    subject: ensureReplySubject(message.subject),
    bodyText: quotedBody.trimStart(),
    replyToMessageId: message.id
  } satisfies ComposerState;
}

export default function KlarApp() {
  const refreshedMessageIdsRef = useRef<Set<string>>(new Set());
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [lens, setLens] = useState<Lens>("omnis");
  const [mailbox, setMailbox] = useState<Mailbox>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [session, setSession] = useState<SessionState>(defaultSessionState);
  const [importedMessages, setImportedMessages] = useState<ImportedMessage[]>([]);
  const [mailSettings, setMailSettings] = useState<MailSettings>(defaultMailSettings);
  const [composer, setComposer] = useState<ComposerState>(defaultComposerState);
  const [syncing, setSyncing] = useState(false);
  const [hydratingMessageId, setHydratingMessageId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const isDark = theme === "dark";
  const ui = useMemo(
    () => ({
      panel: isDark
        ? "border-white/10 bg-slate-950/55 shadow-[0_28px_80px_rgba(2,6,23,0.5)]"
        : "border-black/10 bg-white/70 shadow-sm",
      panelSoft: isDark
        ? "border-white/10 bg-slate-900/55 shadow-[0_24px_60px_rgba(2,6,23,0.36)]"
        : "border-black/10 bg-white/65 shadow-sm",
      panelSolid: isDark
        ? "border-white/10 bg-slate-900/82 shadow-[0_24px_60px_rgba(2,6,23,0.42)]"
        : "border-black/10 bg-white shadow-sm",
      card: isDark ? "border-white/10 bg-slate-900/72" : "border-black/10 bg-white",
      cardSoft: isDark ? "border-white/10 bg-slate-900/52" : "border-black/10 bg-white/60",
      plainBox: isDark ? "border-white/10 bg-slate-950/72" : "border-black/10 bg-slate-50/60",
      activePill: isDark ? "border-white/20 bg-slate-800 text-slate-100 shadow-sm" : "border-black/50 bg-white shadow-sm",
      inactivePill: isDark ? "border-white/10 bg-slate-900/40 text-slate-300" : "border-black/10 bg-white/40",
      primaryButton: isDark
        ? "border-white/10 bg-slate-100 text-slate-950 hover:bg-white"
        : "border-black/20 bg-black text-white hover:bg-slate-800",
      secondaryButton: isDark
        ? "border-white/15 bg-slate-900/80 text-slate-100 hover:border-white/30"
        : "border-black/20 bg-white text-slate-900 hover:border-black/40",
      ghostButton: isDark
        ? "border-white/10 bg-slate-900/40 text-slate-300 hover:border-white/20 hover:text-slate-100"
        : "border-black/10 bg-white/70 text-slate-600 hover:border-black/30 hover:text-slate-900",
      input: isDark
        ? "border-white/10 bg-slate-950/82 text-slate-100 placeholder:text-slate-500 ring-cyan-500/30"
        : "border-black/10 bg-white text-slate-900 ring-black/20",
      muted: isDark ? "text-slate-400" : "text-slate-500",
      subtle: isDark ? "text-slate-500" : "text-slate-400",
      strong: isDark ? "text-slate-50" : "text-slate-900",
      body: isDark ? "text-slate-200" : "text-slate-700",
      time: isDark ? "text-slate-500" : "text-slate-400",
      dangerButton: isDark
        ? "border-rose-500/30 text-rose-300 hover:border-rose-400"
        : "border-rose-200 text-rose-700 hover:border-rose-400",
      neutralBadge: isDark ? "border-white/10 text-slate-300" : "border-black/10 text-slate-500",
      mirrorBadge: isDark
        ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
        : "border-amber-200 bg-amber-50 text-amber-700",
      emptyState: isDark
        ? "border-white/10 bg-slate-950/45 text-slate-400"
        : "border-black/10 bg-white/60 text-slate-500",
      modal: isDark ? "bg-slate-900 text-slate-100 shadow-[0_40px_100px_rgba(2,6,23,0.55)]" : "bg-white",
      overlay: isDark ? "bg-black/50" : "bg-black/20",
      title: isDark ? "text-slate-50" : "text-slate-900"
    }),
    [isDark]
  );

  useEffect(() => {
    const nextTheme = resolveTheme();
    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("klar-theme", theme);
  }, [theme]);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("authError");
    if (authError) {
      setStatusError("Google sign-in could not be completed. Please try again.");
    }
  }, []);

  useEffect(() => {
    async function loadMailboxData() {
      const [messagesResponse, settingsResponse] = await Promise.all([
        fetch("/api/email/list", { cache: "no-store" }),
        fetch("/api/email/settings", { cache: "no-store" })
      ]);

      if (messagesResponse.ok) {
        const messagesPayload = (await messagesResponse.json()) as {
          messages: ImportedMessage[];
        };
        startTransition(() => {
          setImportedMessages(messagesPayload.messages);
        });
      }

      if (settingsResponse.ok) {
        const settingsPayload = (await settingsResponse.json()) as {
          settings: MailSettings;
        };
        setMailSettings(settingsPayload.settings);
      }
    }

    async function loadSession() {
      const response = await fetch("/api/session", { cache: "no-store" });
      const payload = (await response.json()) as {
        authenticated: boolean;
        googleConfigured: boolean;
        user?: SessionState["user"];
        messageCount?: number;
      };

      setSession({
        loading: false,
        authenticated: payload.authenticated,
        googleConfigured: payload.googleConfigured,
        user: payload.user ?? null,
        messageCount: payload.messageCount ?? 0
      });

      if (payload.authenticated) {
        await loadMailboxData();
      }
    }

    void loadSession();
  }, []);

  const mailboxCounts = useMemo(() => {
    return importedMessages.reduce<Record<Mailbox, number>>(
      (counts, message) => {
        counts[message.mailbox] += 1;
        return counts;
      },
      { inbox: 0, sent: 0, trash: 0 }
    );
  }, [importedMessages]);

  const visibleMessages = useMemo(() => {
    if (importedMessages.length === 0) return [];

    return importedMessages.filter((message) => {
      if (message.mailbox !== mailbox) return false;
      if (lens === "omnis") return true;
      return classifyLens(message) === lens;
    });
  }, [importedMessages, lens, mailbox]);

  const fallbackStream = useMemo(() => {
    if (lens === "omnis") return streamItems;
    return streamItems.filter((item) => item.lens === lens);
  }, [lens]);

  const activeStream = useMemo(() => {
    if (importedMessages.length > 0) {
      return toStreamItems(visibleMessages);
    }

    return fallbackStream;
  }, [fallbackStream, importedMessages.length, visibleMessages]);

  const satoriBrief = useMemo(() => {
    const workCount = activeStream.filter((f) => f.lens === "opus").length;
    const financeCount = activeStream.filter((f) => f.lens === "fiscus").length;
    return `Prioritize ${workCount > 0 ? "Q4 logistics" : "response clearing"} first; ${financeCount > 0 ? "settle invoice checks" : "defer low-urgency items"} later. Keep your focus narrow and finish one thread before switching.`;
  }, [activeStream]);

  const visibleMessageLookup = useMemo(
    () => new Map(visibleMessages.map((message) => [message.id, message])),
    [visibleMessages]
  );

  useEffect(() => {
    if (selectedId && !activeStream.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [activeStream, selectedId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function resetStatus() {
    setStatusError(null);
    setStatusMessage(null);
  }

  const applyMessages = useCallback((messages: ImportedMessage[]) => {
    startTransition(() => {
      setImportedMessages(messages);
    });
    setSession((current) => ({
      ...current,
      messageCount: messages.filter((message) => message.mailbox !== "trash").length
    }));
  }, []);

  async function syncMessages() {
    setSyncing(true);
    resetStatus();

    try {
      const response = await fetch("/api/email/sync", {
        method: "POST"
      });
      const payload = (await response.json()) as {
        error?: string;
        imported?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Sync failed");
      }

      const messagesResponse = await fetch("/api/email/list", { cache: "no-store" });
      const messagesPayload = (await messagesResponse.json()) as {
        messages: ImportedMessage[];
      };

      applyMessages(messagesPayload.messages);
      setSession((current) => ({
        ...current,
        user: current.user
          ? {
              ...current.user,
              lastSyncedAt: new Date().toISOString()
            }
          : current.user
      }));
      setStatusMessage(`Imported ${payload.imported ?? messagesPayload.messages.length} messages from Gmail.`);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function saveMirrorSetting(checked: boolean) {
    setSavingSettings(true);
    resetStatus();

    try {
      const response = await fetch("/api/email/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mirrorActionsToGmail: checked
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        settings?: MailSettings;
      };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error ?? "Could not save settings");
      }

      setMailSettings(payload.settings);
      setStatusMessage(
        checked
          ? "Mirror preference saved. Gmail writeback is still off for now, so Klar will continue storing actions locally only."
          : "Mirror preference cleared. Klar actions stay local only."
      );
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function submitComposer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    resetStatus();

    try {
      const response = await fetch("/api/email/compose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: composer.to,
          cc: composer.cc,
          subject: composer.subject,
          bodyText: composer.bodyText,
          replyToMessageId: composer.replyToMessageId
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: ImportedMessage;
      };

      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? "Could not save message");
      }

      applyMessages([payload.message, ...importedMessages.filter((message) => message.id !== payload.message?.id)]);
      setMailbox("sent");
      setSelectedId(payload.message.id);
      setComposer(defaultComposerState);
      setStatusMessage(
        mailSettings.mirrorActionsToGmail
          ? "Message stored in Klar sent mail. Gmail mirror preference is saved, but Gmail writeback is not active yet."
          : "Message stored in Klar sent mail."
      );
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Could not save message");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(messageId: string) {
    resetStatus();

    try {
      const response = await fetch("/api/email/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messageId
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: ImportedMessage;
      };

      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? "Could not delete message");
      }

      const nextMessages = importedMessages.map((message) =>
        message.id === payload.message?.id ? payload.message : message
      );
      applyMessages(nextMessages);
      if (mailbox !== "trash") {
        setSelectedId(null);
      }
      setStatusMessage(
        mailSettings.mirrorActionsToGmail
          ? "Message moved to Klar trash. Gmail mirror preference is saved, but Gmail writeback is not active yet."
          : "Message moved to Klar trash."
      );
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Could not delete message");
    }
  }

  useEffect(() => {
    const message = selectedId ? visibleMessageLookup.get(selectedId) : null;
    if (
      !message ||
      message.source !== "gmail" ||
      hydratingMessageId === message.id ||
      refreshedMessageIdsRef.current.has(message.id)
    ) {
      return;
    }
    const targetMessage = message;

    let cancelled = false;

    async function hydrateMessage() {
      setHydratingMessageId(targetMessage.id);

      try {
        const response = await fetch(`/api/email/message/${targetMessage.id}`, {
          method: "POST"
        });
        const payload = (await response.json()) as {
          error?: string;
          message?: ImportedMessage;
        };

        if (!response.ok || !payload.message || cancelled) {
          return;
        }

        refreshedMessageIdsRef.current.add(targetMessage.id);
        startTransition(() => {
          setImportedMessages((current) =>
            current.map((entry) => (entry.id === payload.message?.id ? payload.message : entry))
          );
        });
      } catch {
        // Keep the current plain-text fallback if the refresh fails.
      } finally {
        if (!cancelled) {
          setHydratingMessageId((current) => (current === targetMessage.id ? null : current));
        }
      }
    }

    void hydrateMessage();

    return () => {
      cancelled = true;
    };
  }, [hydratingMessageId, selectedId, visibleMessageLookup]);

  return (
    <main className="min-h-screen p-8 transition-colors duration-300 md:p-14">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className={`text-4xl font-light tracking-tight ${ui.title}`}>Klar</h1>
              <p className={`mt-2 text-sm ${ui.muted}`}>
                Encrypted local mail cache with Gmail as the source of truth.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                className={`rounded-full border px-4 py-2 text-sm transition ${ui.ghostButton}`}
              >
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              {session.authenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    resetStatus();
                    setComposer((current) => ({
                      ...defaultComposerState,
                      open: !current.open || current.replyToMessageId !== null
                    }));
                  }}
                  className={`rounded-full border px-4 py-2 text-sm transition ${ui.primaryButton}`}
                >
                  Compose
                </button>
              ) : null}
            </div>
          </div>

          <section className={`rounded-3xl border p-5 ${ui.panel}`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <p className={`text-xs uppercase tracking-[0.3em] ${ui.subtle}`}>Google Inbox</p>
                {session.loading ? (
                  <p className={`text-sm ${ui.muted}`}>Checking account status...</p>
                ) : session.authenticated && session.user ? (
                  <div className="space-y-1">
                    <p className={`text-base font-medium ${ui.strong}`}>
                      Connected as {session.user.name}
                    </p>
                    <p className={`text-sm ${ui.muted}`}>
                      {session.user.email} · {session.messageCount} active messages in Klar
                    </p>
                    <p className={`text-sm ${ui.muted}`}>
                      {session.user.lastSyncedAt
                        ? `Last synced ${new Date(session.user.lastSyncedAt).toLocaleString()}`
                        : "No Gmail sync has run yet."}
                    </p>
                  </div>
                ) : session.googleConfigured ? (
                  <p className={`text-sm ${ui.muted}`}>
                    Connect a Google account to import full Gmail messages into Klar&apos;s encrypted local cache.
                  </p>
                ) : (
                  <p className="text-sm text-amber-700">
                    Google OAuth is not configured yet. Add the required env vars to enable sign-in.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {!session.authenticated && session.googleConfigured ? (
                  <a
                    href="/api/auth/google/start"
                    className={`rounded-full border px-4 py-2 text-sm transition ${ui.primaryButton}`}
                  >
                    Continue with Google
                  </a>
                ) : null}
                {session.authenticated ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void syncMessages()}
                      disabled={syncing}
                      className={`rounded-full border px-4 py-2 text-sm transition disabled:cursor-wait disabled:opacity-60 ${ui.secondaryButton}`}
                    >
                      {syncing ? "Syncing..." : "Sync Gmail"}
                    </button>
                    <form action="/api/auth/logout" method="post">
                      <button
                        type="submit"
                        className={`rounded-full border px-4 py-2 text-sm transition ${ui.ghostButton}`}
                      >
                        Sign out
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
            </div>
            {statusMessage ? <p className="mt-3 text-sm text-emerald-700">{statusMessage}</p> : null}
            {statusError ? <p className="mt-3 text-sm text-rose-700">{statusError}</p> : null}
          </section>

          {session.authenticated ? (
            <section className={`grid gap-4 rounded-3xl border p-5 md:grid-cols-[1.5fr,1fr] ${ui.panelSoft}`}>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {mailboxViews.map((entry) => {
                    const active = mailbox === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={`rounded-full border px-4 py-2 text-sm transition ${
                          active ? ui.activePill : ui.inactivePill
                        }`}
                        onClick={() => {
                          setMailbox(entry.id);
                          setSelectedId(null);
                        }}
                      >
                        {entry.label} <span className={ui.subtle}>{mailboxCounts[entry.id]}</span>
                      </button>
                    );
                  })}
                </div>
                <p className={`text-sm ${ui.muted}`}>
                  Gmail remains untouched. Compose, reply, and delete are local Klar actions for now.
                </p>
              </div>
              <label className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${ui.body} ${ui.cardSoft}`}>
                <input
                  type="checkbox"
                  checked={mailSettings.mirrorActionsToGmail}
                  disabled={savingSettings}
                  onChange={(event) => void saveMirrorSetting(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-black/20"
                />
                <span>
                  <span className={`block font-medium ${ui.strong}`}>Mirror actions to Gmail later</span>
                  Preference is saved now, but writeback is not implemented yet. This keeps the user choice ready
                  without touching Gmail today.
                </span>
              </label>
            </section>
          ) : null}

          {session.authenticated && composer.open ? (
            <section className={`rounded-3xl border p-5 ${ui.panelSolid}`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className={`text-lg font-medium ${ui.strong}`}>
                    {composer.replyToMessageId ? "Reply in Klar" : "Compose in Klar"}
                  </h2>
                  <p className={`text-sm ${ui.muted}`}>
                    This saves a full local message in Klar&apos;s encrypted store.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setComposer(defaultComposerState)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${ui.ghostButton}`}
                >
                  Close
                </button>
              </div>
              <form className="space-y-3" onSubmit={(event) => void submitComposer(event)}>
                <input
                  value={composer.to}
                  onChange={(event) => setComposer((current) => ({ ...current, to: event.target.value }))}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring ${ui.input}`}
                  placeholder="To"
                />
                <input
                  value={composer.cc}
                  onChange={(event) => setComposer((current) => ({ ...current, cc: event.target.value }))}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring ${ui.input}`}
                  placeholder="Cc"
                />
                <input
                  value={composer.subject}
                  onChange={(event) => setComposer((current) => ({ ...current, subject: event.target.value }))}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring ${ui.input}`}
                  placeholder="Subject"
                />
                <textarea
                  value={composer.bodyText}
                  onChange={(event) => setComposer((current) => ({ ...current, bodyText: event.target.value }))}
                  className={`min-h-48 w-full rounded-2xl border px-4 py-3 text-sm leading-7 outline-none focus:ring ${ui.input}`}
                  placeholder="Write the full message here"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-xs ${ui.subtle}`}>
                    {mailSettings.mirrorActionsToGmail
                      ? "Mirror preference is saved, but this send stays local until Gmail writeback is implemented."
                      : "Stored locally only."}
                  </p>
                  <button
                    type="submit"
                    disabled={sending}
                    className={`rounded-full border px-4 py-2 text-sm transition disabled:cursor-wait disabled:opacity-60 ${ui.primaryButton}`}
                  >
                    {sending ? "Saving..." : "Save message"}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {lenses.map((entry) => {
              const active = lens === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={active}
                  className={`rounded-full border px-4 py-2 text-sm transition ${active ? ui.activePill : ui.inactivePill}`}
                  onClick={() => {
                    setLens(entry.id);
                    setSelectedId(null);
                  }}
                >
                  <span className={`${active ? entry.color : ui.subtle} mr-2`}>{active ? "◉" : "◌"}</span>
                  {entry.label}
                </button>
              );
            })}
          </div>
          <div className={`klar-glass rounded-2xl border p-4 text-sm leading-relaxed ${ui.body}`}>
            <span className="font-medium">Satori Briefing:</span> {satoriBrief}
          </div>
        </header>

        {importedMessages.length > 0 && activeStream.length === 0 ? (
          <section className={`rounded-2xl border border-dashed p-6 text-sm ${ui.emptyState}`}>
            No messages in {mailbox} for the current lens.
          </section>
        ) : null}

        {(["hodie", "heri", "olim"] as const).map((bucket) => {
          const items = activeStream.filter((item) => item.bucket === bucket);
          if (items.length === 0) return null;
          return (
            <section key={bucket} className="space-y-3">
              <h2 className={`text-xs uppercase tracking-[0.2em] ${ui.subtle}`}>{bucketLabels[bucket]}</h2>
              <div className="space-y-3">
                {items.map((item) => {
                  const selected = selectedId === item.id;
                  const dimmed = selectedId !== null && !selected;
                  const message = visibleMessageLookup.get(item.id);
                  return (
                    <motion.article
                      key={item.id}
                      layout
                      onClick={() => setSelectedId((current) => (current === item.id ? null : item.id))}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${
                        selected ? `scale-[1.01] shadow-zanshin ${ui.panelSolid}` : ui.card
                      } ${dimmed ? "scale-[0.985] opacity-30 blur-[1px]" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-sm ${ui.muted}`}>{item.sender}</p>
                          <h3 className={`text-base font-medium ${ui.strong}`}>{item.subject}</h3>
                          <p className={`text-sm ${ui.muted}`}>{item.preview}</p>
                        </div>
                        <time className={`shrink-0 whitespace-nowrap text-xs ${ui.time}`}>{item.time}</time>
                      </div>
                      <AnimatePresence initial={false}>
                        {selected ? (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mt-4 space-y-4"
                          >
                            {message ? (
                              <>
                                <div className={`flex flex-wrap gap-2 text-xs ${ui.muted}`}>
                                  <span className={`rounded-full border px-2 py-1 uppercase tracking-[0.2em] ${ui.neutralBadge}`}>
                                    {message.source}
                                  </span>
                                  <span className={`rounded-full border px-2 py-1 uppercase tracking-[0.2em] ${ui.neutralBadge}`}>
                                    {message.mailbox}
                                  </span>
                                  {message.mirrorRequested ? (
                                    <span className={`rounded-full border px-2 py-1 ${ui.mirrorBadge}`}>
                                      Mirror queued
                                    </span>
                                  ) : null}
                                </div>
                                <dl className={`grid gap-2 text-sm ${ui.body} md:grid-cols-[72px,1fr]`}>
                                  <dt className={`font-medium ${ui.strong}`}>From</dt>
                                  <dd>{message.from}</dd>
                                  <dt className={`font-medium ${ui.strong}`}>To</dt>
                                  <dd>{joinAddresses(message.to)}</dd>
                                  {message.cc.length > 0 ? (
                                    <>
                                      <dt className={`font-medium ${ui.strong}`}>Cc</dt>
                                      <dd>{joinAddresses(message.cc)}</dd>
                                    </>
                                  ) : null}
                                  <dt className={`font-medium ${ui.strong}`}>Date</dt>
                                  <dd>{toFullDateLabel(message.internalDate)}</dd>
                                </dl>
                                <div className={`rounded-2xl border p-4 ${ui.plainBox}`}>
                                  {message.bodyHtml ? (
                                    <EmailHtml html={message.bodyHtml} theme={theme} />
                                  ) : (
                                    <p className={`whitespace-pre-wrap text-sm leading-7 ${ui.body}`}>
                                      {message.bodyText || message.snippet || "No message body available."}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setComposer(createReplyDraft(message));
                                    }}
                                    className={`rounded-full border px-3 py-1 text-xs transition ${ui.secondaryButton}`}
                                  >
                                    Reply
                                  </button>
                                  {message.mailbox !== "trash" ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void deleteMessage(message.id);
                                      }}
                                      className={`rounded-full border px-3 py-1 text-xs transition ${ui.dangerButton}`}
                                    >
                                      Delete in Klar
                                    </button>
                                  ) : (
                                    <span className={`rounded-full border px-3 py-1 text-xs ${ui.neutralBadge}`}>
                                      Stored in Klar trash only
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <p className={`text-sm ${ui.muted}`}>
                                Mock stream item. Connect Gmail to view full message content.
                              </p>
                            )}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className={`space-y-3 rounded-2xl border p-5 ${ui.cardSoft}`}>
          <h2 className={`text-lg ${ui.strong}`}>Karakuri Engine (Agent Lab)</h2>
          <p className={`text-sm ${ui.muted}`}>Prototype input for natural language workflow commands.</p>
          <input
            suppressHydrationWarning
            className={`w-full rounded-xl border px-4 py-3 outline-none focus:ring ${ui.input}`}
            placeholder='Try: "Extract all Q4 dates from my work emails"'
          />
        </section>
      </div>

      <AnimatePresence>
        {showPalette ? (
          <motion.div
            className={`fixed inset-0 z-50 flex items-start justify-center p-8 backdrop-blur-xl ${ui.overlay}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPalette(false)}
          >
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              className={`w-full max-w-2xl rounded-2xl p-5 ${ui.modal}`}
              onClick={(event) => event.stopPropagation()}
            >
              <input
                autoFocus
                suppressHydrationWarning
                placeholder="Jump to Inbox, Projects, Agents, or Prisma lens…"
                className={`w-full border-none bg-transparent font-serif text-2xl outline-none ${ui.strong}`}
              />
              <p className={`mt-3 text-xs ${ui.subtle}`}>Cmd/Ctrl + K to toggle</p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
