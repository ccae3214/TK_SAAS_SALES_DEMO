import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { requireCsrf } from "@/lib/security";

export const dynamic = "force-dynamic";
const getOwner = async () => (await auth())?.user?.email?.trim().toLowerCase() || null;

export async function GET() {
  const email = await getOwner();
  if (!email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try { return NextResponse.json(await query("SELECT id,name FROM note_folders WHERE user_email=$1 ORDER BY name", [email])); }
  catch (error) { console.error("Folder list error:", error); return NextResponse.json({ error: "Could not load folders" }, { status: 500 }); }
}

export async function POST(request) {
  const email = await getOwner();
  if (!email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!requireCsrf(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  try {
    const name = (await request.json()).name?.trim();
    if (!name || name.length > 100) return NextResponse.json({ error: "Folder name is required (max 100 characters)" }, { status: 400 });
    const rows = await query("INSERT INTO note_folders(user_email,name) VALUES($1,$2) RETURNING id,name", [email, name]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Folder already exists" }, { status: 409 });
    console.error("Folder create error:", error); return NextResponse.json({ error: "Could not create folder" }, { status: 500 });
  }
}

export async function DELETE(request) {
  const email = await getOwner();
  if (!email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!requireCsrf(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid folder ID" }, { status: 400 });
  try {
    const rows = await query("DELETE FROM note_folders WHERE id=$1 AND user_email=$2 RETURNING id", [id, email]);
    return rows[0] ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Folder not found" }, { status: 404 });
  } catch (error) { console.error("Folder delete error:", error); return NextResponse.json({ error: "Could not delete folder" }, { status: 500 }); }
}
