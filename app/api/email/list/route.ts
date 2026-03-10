import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/session";
import { readMessages } from "@/lib/server/mail-store";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await readMessages(session.userId);
  return NextResponse.json({ messages });
}
