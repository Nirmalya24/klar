import { NextResponse } from "next/server";
import { fetchGmailMessage, refreshGoogleAccessToken } from "@/lib/server/google";
import { readMessages, readOauthTokens, storeOauthTokens, upsertMessage } from "@/lib/server/mail-store";
import { getSession } from "@/lib/server/session";

type RouteContext = {
  params: Promise<{
    messageId: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId } = await context.params;
    const existingMessages = await readMessages(session.userId);
    const existing = existingMessages.find((message) => message.id === messageId);

    if (!existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (existing.source !== "gmail") {
      return NextResponse.json({ message: existing });
    }

    const tokens = await readOauthTokens(session.userId);
    if (!tokens) {
      return NextResponse.json({ error: "Google account not connected" }, { status: 400 });
    }

    const refreshed = await refreshGoogleAccessToken(tokens.refreshToken);
    await storeOauthTokens(session.userId, refreshed, tokens.refreshToken);
    const message = await fetchGmailMessage(refreshed.access_token, messageId);
    const stored = await upsertMessage(session.userId, message);

    return NextResponse.json({ message: stored });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not refresh message"
      },
      { status: 500 }
    );
  }
}
