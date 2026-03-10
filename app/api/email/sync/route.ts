import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/session";
import { fetchGmailMessages, refreshGoogleAccessToken } from "@/lib/server/google";
import { readOauthTokens, storeMessages, storeOauthTokens } from "@/lib/server/mail-store";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokens = await readOauthTokens(session.userId);
    if (!tokens) {
      return NextResponse.json({ error: "Google account not connected" }, { status: 400 });
    }

    const refreshed = await refreshGoogleAccessToken(tokens.refreshToken);
    await storeOauthTokens(session.userId, refreshed, tokens.refreshToken);
    const messages = await fetchGmailMessages(refreshed.access_token, 25);
    await storeMessages(session.userId, messages);

    return NextResponse.json({
      imported: messages.length
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Email sync failed"
      },
      { status: 500 }
    );
  }
}
