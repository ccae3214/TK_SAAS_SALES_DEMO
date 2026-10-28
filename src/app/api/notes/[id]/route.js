import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { requireCsrf } from "@/lib/security";

export const dynamic = "force-dynamic";
const getOwner = async () => (await auth())?.user?.email?.trim().toLowerCase() || null;

export async function GET(_request, { params }) {
  const email = await getOwner();
  if (!email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  try {
    const rows = await query("SELECT * FROM user_notes WHERE id=$1 AND user_email=$2", [id, email]);
    return rows[0] ? NextResponse.json(rows[0]) : NextResponse.json({ error: "Note not found" }, { status: 404 });
  } catch (error) { console.error("Note fetch error:", error); return NextResponse.json({ error: "Could not load note" }, { status: 500 }); }
}

export async function PUT(request, { params }) {
  const email = await getOwner();
  if (!email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!requireCsrf(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const { id } = await params;
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.slice(0, 300) : "";
    const content = typeof body.content === "string" ? body.content.slice(0, 500000) : "";
    const tags = Array.isArray(body.tags) ? body.tags.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 30) : [];
    const folderId = body.folder_id ? Number(body.folder_id) : null;
    if (folderId && !(await query("SELECT id FROM note_folders WHERE id=$1 AND user_email=$2", [folderId, email])).length) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    const rows = await query(`UPDATE user_notes SET title=$1,content=$2,tags=$3,folder_id=$4,pinned=$5,archived=$6,updated_at=now()
      WHERE id=$7 AND user_email=$8 RETURNING *`, [title, content, tags, folderId, Boolean(body.pinned), Boolean(body.archived), id, email]);
    return rows[0] ? NextResponse.json(rows[0]) : NextResponse.json({ error: "Note not found" }, { status: 404 });
  } catch (error) { console.error("Note update error:", error); return NextResponse.json({ error: "Could not update note" }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  const email = await getOwner();
  if (!email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!requireCsrf(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const { id } = await params;
  try {
    const rows = await query("DELETE FROM user_notes WHERE id=$1 AND user_email=$2 RETURNING id", [id, email]);
    return rows[0] ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Note not found" }, { status: 404 });
  } catch (error) { console.error("Note delete error:", error); return NextResponse.json({ error: "Could not delete note" }, { status: 500 }); }
}
