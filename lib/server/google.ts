import { randomBytes } from "node:crypto";
import { getServerEnv } from "@/lib/server/env";
import { decodeEmailFragment, normalizeEmailBodies } from "@/lib/mail-content";
import type { ImportedMessage } from "@/lib/types";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
};

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
};

export type GmailMessageSummary = ImportedMessage;

function base64UrlDecode(value: string) {
  return decodeEmailFragment(
    Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
  );
}

type MessagePart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: MessagePart[];
};

function collectParts(part: MessagePart | null | undefined, mimeType: string): string[] {
  if (!part) return [];

  const matches: string[] = [];
  if (part.mimeType === mimeType && part.body?.data) {
    matches.push(part.body.data);
  }

  for (const child of part.parts ?? []) {
    matches.push(...collectParts(child, mimeType));
  }

  return matches;
}

function toMailbox(labelIds: string[]) {
  if (labelIds.includes("TRASH")) return "trash" as const;
  if (labelIds.includes("SENT")) return "sent" as const;
  return "inbox" as const;
}

function splitAddressHeader(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function createGoogleState() {
  return randomBytes(24).toString("base64url");
}

export function createGoogleAuthUrl(state: string) {
  const env = getServerEnv();
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", env.googleClientId);
  url.searchParams.set("redirect_uri", env.googleRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.readonly"
  ].join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleCode(code: string) {
  const env = getServerEnv();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: env.googleRedirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Google OAuth code");
  }

  return (await response.json()) as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const env = getServerEnv();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Google access token");
  }

  return (await response.json()) as GoogleTokenResponse;
}

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Google profile");
  }

  return (await response.json()) as GoogleProfile;
}

async function fetchRawGmailMessage(accessToken: string, id: string) {
  const messageResponse = await fetch(`${GMAIL_MESSAGES_URL}/${id}?format=full`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!messageResponse.ok) {
    const body = await messageResponse.text();
    throw new Error(`Failed to fetch Gmail message ${id}: ${body}`);
  }

  return (await messageResponse.json()) as {
    id: string;
    threadId: string;
    labelIds?: string[];
    snippet?: string;
    internalDate?: string;
    payload?: MessagePart & {
      headers?: Array<{ name: string; value: string }>;
    };
  };
}

function normalizeRawGmailMessage(message: Awaited<ReturnType<typeof fetchRawGmailMessage>>) {
  const headers = new Map(
    (message.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value])
  );
  const labelIds = message.labelIds ?? [];
  const textParts = collectParts(message.payload ?? {}, "text/plain").map(base64UrlDecode);
  const htmlParts = collectParts(message.payload ?? {}, "text/html").map(base64UrlDecode);
  const normalizedBodies = normalizeEmailBodies({
    bodyText: textParts.join("\n\n").trim(),
    bodyHtml: htmlParts.join("\n\n").trim() || null
  });

  return {
    id: message.id,
    threadId: message.threadId,
    labelIds,
    snippet: message.snippet ?? "",
    subject: headers.get("subject") ?? "(No subject)",
    from: headers.get("from") ?? "Unknown sender",
    to: splitAddressHeader(headers.get("to")),
    cc: splitAddressHeader(headers.get("cc")),
    internalDate: message.internalDate ?? new Date().toISOString(),
    bodyText: normalizedBodies.bodyText,
    bodyHtml: normalizedBodies.bodyHtml,
    source: "gmail",
    mailbox: toMailbox(labelIds),
    deletedAt: null,
    replyToMessageId: null,
    mirrorRequested: false,
    mirroredToGmail: true
  } satisfies GmailMessageSummary;
}

export async function fetchGmailMessage(accessToken: string, id: string) {
  const raw = await fetchRawGmailMessage(accessToken, id);
  return normalizeRawGmailMessage(raw);
}

export async function fetchGmailMessages(accessToken: string, maxResults = 20) {
  const listResponse = await fetch(`${GMAIL_MESSAGES_URL}?maxResults=${maxResults}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!listResponse.ok) {
    const body = await listResponse.text();
    throw new Error(`Failed to list Gmail messages: ${body}`);
  }

  const listPayload = (await listResponse.json()) as {
    messages?: Array<{ id: string }>;
  };

  return Promise.all((listPayload.messages ?? []).map(({ id }) => fetchGmailMessage(accessToken, id)));
}
