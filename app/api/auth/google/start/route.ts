import { NextResponse } from "next/server";
import { createGoogleAuthUrl, createGoogleState } from "@/lib/server/google";
import { hasGoogleOAuthConfig } from "@/lib/server/env";
import { setOauthState } from "@/lib/server/session";

export async function GET() {
  if (!hasGoogleOAuthConfig()) {
    return NextResponse.json(
      { error: "Google OAuth environment variables are not configured." },
      { status: 500 }
    );
  }

  const state = createGoogleState();
  const response = NextResponse.redirect(createGoogleAuthUrl(state));
  await setOauthState(response, state);
  return response;
}
