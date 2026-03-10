import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { appendLocalMessage, readMailSettings, readUser } from "@/lib/server/mail-store";
import { getSession } from "@/lib/server/session";
import type { ImportedMessage } from "@/lib/types";

function normalizeAddresses(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter(Boolean);
  }

  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    to?: string | string[];
    cc?: string | string[];
    subject?: string;
    bodyText?: string;
    replyToMessageId?: string | null;
  };

  const to = normalizeAddresses(body.to);
  const cc = normalizeAddresses(body.cc);
  const subject = body.subject?.trim() ?? "";
  const bodyText = body.bodyText?.trim() ?? "";

  if (to.length === 0) {
    return NextResponse.json({ error: "Add at least one recipient" }, { status: 400 });
  }

  if (!subject) {
    return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  }

  if (!bodyText) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const [user, settings] = await Promise.all([
    readUser(session.userId),
    readMailSettings(session.userId)
  ]);

  if (!user) {
    return NextResponse.json({ error: "User account missing" }, { status: 400 });
  }

  const now = new Date();
  const message: ImportedMessage = {
    id: `local-${randomUUID()}`,
    threadId: body.replyToMessageId ?? `local-thread-${randomUUID()}`,
    labelIds: ["LOCAL"],
    snippet: bodyText.slice(0, 160),
    subject,
    from: `${user.name} <${user.email}>`,
    to,
    cc,
    internalDate: now.getTime().toString(),
    bodyText,
    bodyHtml: null,
    source: "local",
    mailbox: "sent",
    deletedAt: null,
    replyToMessageId: body.replyToMessageId ?? null,
    mirrorRequested: settings.mirrorActionsToGmail,
    mirroredToGmail: false
  };

  const stored = await appendLocalMessage(session.userId, message);
  return NextResponse.json({ message: stored }, { status: 201 });
}
