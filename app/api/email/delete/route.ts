import { NextRequest, NextResponse } from "next/server";
import { moveMessageToMailbox, readMailSettings } from "@/lib/server/mail-store";
import { getSession } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    messageId?: string;
  };

  if (!body.messageId) {
    return NextResponse.json({ error: "Message id is required" }, { status: 400 });
  }

  const settings = await readMailSettings(session.userId);
  const message = await moveMessageToMailbox(session.userId, body.messageId, "trash", {
    markMirrorRequested: settings.mirrorActionsToGmail
  });

  return NextResponse.json({ message });
}
