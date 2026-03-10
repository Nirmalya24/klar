import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/server/session";
import { readMailSettings, storeMailSettings } from "@/lib/server/mail-store";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await readMailSettings(session.userId);
  return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    mirrorActionsToGmail?: boolean;
  };

  const settings = await storeMailSettings(session.userId, {
    mirrorActionsToGmail: Boolean(body.mirrorActionsToGmail)
  });

  return NextResponse.json({ settings });
}
