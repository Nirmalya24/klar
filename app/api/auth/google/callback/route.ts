import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, fetchGoogleProfile } from "@/lib/server/google";
import { getServerEnv } from "@/lib/server/env";
import { storeOauthTokens, upsertUser } from "@/lib/server/mail-store";
import {
  KlarSession,
  clearOauthState,
  readOauthState,
  setSession
} from "@/lib/server/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = await readOauthState();

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/?authError=google_oauth_state", getServerEnv().appUrl));
  }

  const tokenResponse = await exchangeGoogleCode(code);
  const profile = await fetchGoogleProfile(tokenResponse.access_token);
  const user = await upsertUser(profile);
  await storeOauthTokens(user.id, tokenResponse);

  const session: KlarSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7
  };

  const response = NextResponse.redirect(new URL("/", getServerEnv().appUrl));
  clearOauthState(response);
  await setSession(response, session);
  return response;
}
