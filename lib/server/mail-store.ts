import { normalizeEmailBodies } from "@/lib/mail-content";
import { decryptJson, encryptJson } from "@/lib/server/crypto";
import { getServerEnv } from "@/lib/server/env";
import { readStoredRecord, writeStoredRecord } from "@/lib/server/storage";
import type { GmailMessageSummary, GoogleProfile, GoogleTokenResponse } from "@/lib/server/google";
import type { ImportedMessage, MailSettings, Mailbox } from "@/lib/types";

type StoredUser = {
  id: string;
  email: string;
  name: string;
  googleSubject: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
};

type StoredOauthAccount = {
  encrypted: ReturnType<typeof encryptJson<{
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scope: string;
    tokenType: string;
  }>>;
  updatedAt: string;
};

type StoredMessages = {
  encrypted: ReturnType<typeof encryptJson<ImportedMessage[]>>;
  updatedAt: string;
  count: number;
};

type StoredSettings = {
  encrypted: ReturnType<typeof encryptJson<MailSettings>>;
  updatedAt: string;
};

const defaultMailSettings: MailSettings = {
  mirrorActionsToGmail: false
};

function inferMailbox(labelIds: string[]) {
  if (labelIds.includes("TRASH")) return "trash" as const;
  if (labelIds.includes("SENT")) return "sent" as const;
  return "inbox" as const;
}

function normalizeMessage(message: Partial<ImportedMessage> & Pick<ImportedMessage, "id">): ImportedMessage {
  const labelIds = Array.isArray(message.labelIds) ? message.labelIds : [];
  const mailbox = (message.mailbox ?? inferMailbox(labelIds)) as Mailbox;
  const normalizedBodies = normalizeEmailBodies({
    bodyText: message.bodyText ?? "",
    bodyHtml: message.bodyHtml ?? null
  });

  return {
    id: message.id,
    threadId: message.threadId ?? message.id,
    labelIds,
    snippet: message.snippet ?? "",
    subject: message.subject ?? "(No subject)",
    from: message.from ?? "Unknown sender",
    to: Array.isArray(message.to) ? message.to : [],
    cc: Array.isArray(message.cc) ? message.cc : [],
    internalDate: message.internalDate ?? new Date().toISOString(),
    bodyText: normalizedBodies.bodyText,
    bodyHtml: normalizedBodies.bodyHtml,
    source: message.source ?? "gmail",
    mailbox,
    deletedAt: message.deletedAt ?? (mailbox === "trash" ? new Date().toISOString() : null),
    replyToMessageId: message.replyToMessageId ?? null,
    mirrorRequested: message.mirrorRequested ?? false,
    mirroredToGmail: message.mirroredToGmail ?? message.source !== "local"
  };
}

function sortMessages(messages: ImportedMessage[]) {
  return [...messages].sort((left, right) => {
    const leftTime = Number(left.internalDate);
    const rightTime = Number(right.internalDate);
    return (Number.isFinite(rightTime) ? rightTime : Date.parse(right.internalDate)) -
      (Number.isFinite(leftTime) ? leftTime : Date.parse(left.internalDate));
  });
}

export async function upsertUser(profile: GoogleProfile) {
  const now = new Date().toISOString();
  const existing = await readStoredRecord<StoredUser>("users", profile.sub);
  const user: StoredUser = {
    id: profile.sub,
    email: profile.email,
    name: profile.name,
    googleSubject: profile.sub,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastSyncedAt: existing?.lastSyncedAt ?? null
  };

  await writeStoredRecord("users", profile.sub, user);
  return user;
}

export async function storeOauthTokens(
  userId: string,
  tokens: GoogleTokenResponse,
  refreshTokenOverride?: string
) {
  const refreshToken = refreshTokenOverride ?? tokens.refresh_token;
  if (!refreshToken) {
    throw new Error("Missing refresh token for Google account");
  }

  const payload = {
    accessToken: tokens.access_token,
    refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope,
    tokenType: tokens.token_type
  };

  const record: StoredOauthAccount = {
    encrypted: encryptJson(getServerEnv().encryptionKey, payload),
    updatedAt: new Date().toISOString()
  };

  await writeStoredRecord("accounts", userId, record);
}

export async function readOauthTokens(userId: string) {
  const record = await readStoredRecord<StoredOauthAccount>("accounts", userId);
  if (!record) return null;
  return decryptJson<{
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scope: string;
    tokenType: string;
  }>(getServerEnv().encryptionKey, record.encrypted);
}

export async function storeMessages(userId: string, messages: GmailMessageSummary[]) {
  const existing = await readMessages(userId);
  const existingById = new Map(existing.map((message) => [message.id, message]));
  const nextMessages: ImportedMessage[] = [];

  for (const message of messages) {
    const normalized = normalizeMessage(message);
    const local = existingById.get(normalized.id);
    const merged = normalizeMessage({
      ...normalized,
      mailbox: local?.mailbox === "trash" ? "trash" : local?.mailbox ?? normalized.mailbox,
      deletedAt: local?.deletedAt ?? normalized.deletedAt,
      replyToMessageId: local?.replyToMessageId ?? normalized.replyToMessageId,
      mirrorRequested: local?.mirrorRequested ?? normalized.mirrorRequested,
      mirroredToGmail: true
    });

    nextMessages.push(merged);
    existingById.delete(normalized.id);
  }

  for (const leftover of existingById.values()) {
    nextMessages.push(normalizeMessage(leftover));
  }

  const record: StoredMessages = {
    encrypted: encryptJson(getServerEnv().encryptionKey, sortMessages(nextMessages)),
    updatedAt: new Date().toISOString(),
    count: nextMessages.length
  };

  await writeStoredRecord("messages", userId, record);

  const user = await readStoredRecord<StoredUser>("users", userId);
  if (user) {
    await writeStoredRecord("users", userId, {
      ...user,
      updatedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString()
    });
  }
}

export async function readMessages(userId: string) {
  const record = await readStoredRecord<StoredMessages>("messages", userId);
  if (!record) return [];
  const messages = decryptJson<Array<Partial<ImportedMessage> & Pick<ImportedMessage, "id">>>(
    getServerEnv().encryptionKey,
    record.encrypted
  );
  return sortMessages(messages.map((message) => normalizeMessage(message)));
}

export async function readUser(userId: string) {
  return readStoredRecord<StoredUser>("users", userId);
}

export async function readMailSettings(userId: string) {
  const record = await readStoredRecord<StoredSettings>("settings", userId);
  if (!record) return defaultMailSettings;

  return {
    ...defaultMailSettings,
    ...decryptJson<MailSettings>(getServerEnv().encryptionKey, record.encrypted)
  };
}

export async function storeMailSettings(userId: string, settings: MailSettings) {
  const record: StoredSettings = {
    encrypted: encryptJson(getServerEnv().encryptionKey, settings),
    updatedAt: new Date().toISOString()
  };

  await writeStoredRecord("settings", userId, record);
  return settings;
}

export async function appendLocalMessage(userId: string, message: ImportedMessage) {
  const messages = await readMessages(userId);
  const nextMessages = sortMessages([normalizeMessage(message), ...messages.filter((entry) => entry.id !== message.id)]);

  const record: StoredMessages = {
    encrypted: encryptJson(getServerEnv().encryptionKey, nextMessages),
    updatedAt: new Date().toISOString(),
    count: nextMessages.length
  };

  await writeStoredRecord("messages", userId, record);
  return normalizeMessage(message);
}

export async function upsertMessage(userId: string, message: ImportedMessage) {
  const messages = await readMessages(userId);
  const existing = messages.find((entry) => entry.id === message.id);
  const merged = normalizeMessage({
    ...existing,
    ...message,
    mailbox: existing?.mailbox === "trash" ? "trash" : existing?.mailbox ?? message.mailbox,
    deletedAt: existing?.deletedAt ?? message.deletedAt,
    replyToMessageId: existing?.replyToMessageId ?? message.replyToMessageId,
    mirrorRequested: existing?.mirrorRequested ?? message.mirrorRequested,
    mirroredToGmail: message.mirroredToGmail
  });
  const nextMessages = sortMessages([merged, ...messages.filter((entry) => entry.id !== message.id)]);

  const record: StoredMessages = {
    encrypted: encryptJson(getServerEnv().encryptionKey, nextMessages),
    updatedAt: new Date().toISOString(),
    count: nextMessages.length
  };

  await writeStoredRecord("messages", userId, record);
  return merged;
}

export async function moveMessageToMailbox(
  userId: string,
  messageId: string,
  mailbox: Mailbox,
  options?: { markMirrorRequested?: boolean }
) {
  const messages = await readMessages(userId);
  const nextMessages = messages.map((message) => {
    if (message.id !== messageId) return message;

    return normalizeMessage({
      ...message,
      mailbox,
      deletedAt: mailbox === "trash" ? new Date().toISOString() : null,
      mirrorRequested: options?.markMirrorRequested ? true : message.mirrorRequested
    });
  });

  const target = nextMessages.find((message) => message.id === messageId);
  if (!target) {
    throw new Error("Message not found");
  }

  const record: StoredMessages = {
    encrypted: encryptJson(getServerEnv().encryptionKey, sortMessages(nextMessages)),
    updatedAt: new Date().toISOString(),
    count: nextMessages.length
  };

  await writeStoredRecord("messages", userId, record);
  return target;
}
