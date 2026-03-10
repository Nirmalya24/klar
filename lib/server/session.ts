import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/server/env";

const SESSION_COOKIE = "klar_session";
const OAUTH_STATE_COOKIE = "klar_google_state";

export type KlarSession = {
  userId: string;
  email: string;
  name: string;
  expiresAt: number;
};

function sign(value: string) {
  return createHmac("sha256", getServerEnv().sessionSecret).update(value).digest("base64url");
}

function encodeSession(session: KlarSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(raw: string | undefined): KlarSession | null {
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  if (signature.length !== expected.length) return null;
  const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return null;

  const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as KlarSession;
  if (session.expiresAt < Date.now()) return null;
  return session;
}

export async function getSession() {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function setSession(response: NextResponse, session: KlarSession) {
  response.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt)
  });
}

export function clearSession(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE);
}

export async function setOauthState(response: NextResponse, value: string) {
  response.cookies.set(OAUTH_STATE_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10
  });
}

export async function readOauthState() {
  const cookieStore = await cookies();
  return cookieStore.get(OAUTH_STATE_COOKIE)?.value ?? null;
}

export function clearOauthState(response: NextResponse) {
  response.cookies.delete(OAUTH_STATE_COOKIE);
}
