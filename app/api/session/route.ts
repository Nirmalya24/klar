import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/session";
import { readMessages, readUser } from "@/lib/server/mail-store";
import { hasGoogleOAuthConfig } from "@/lib/server/env";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      authenticated: false,
      googleConfigured: hasGoogleOAuthConfig()
    });
  }

  const [user, messages] = await Promise.all([
    readUser(session.userId),
    readMessages(session.userId)
  ]);

  return NextResponse.json({
    authenticated: true,
    googleConfigured: hasGoogleOAuthConfig(),
    user,
    messageCount: messages.filter((message) => message.mailbox !== "trash").length
  });
}
