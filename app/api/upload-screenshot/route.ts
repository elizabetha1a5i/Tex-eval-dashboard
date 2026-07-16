import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

function isAuthorized(req: NextRequest) {
  const expected = process.env.INGEST_API_KEY;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename");
  if (!filename) {
    return NextResponse.json({ error: "Missing filename query param" }, { status: 400 });
  }

  const body = await req.arrayBuffer();
  if (body.byteLength === 0) {
    return NextResponse.json({ error: "Empty file body" }, { status: 400 });
  }

  const blob = await put(`screenshots/${filename}`, Buffer.from(body), {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: true,
  });

  return NextResponse.json({ url: blob.url });
}
