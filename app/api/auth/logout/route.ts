import { NextResponse } from "next/server";
import { clearSession } from "@/lib/server/session";
import { getServerEnv } from "@/lib/server/env";

export async function POST() {
  const response = NextResponse.redirect(new URL("/", getServerEnv().appUrl));
  clearSession(response);
  return response;
}
