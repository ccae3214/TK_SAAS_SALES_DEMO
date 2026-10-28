import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { requireCsrf } from "@/lib/security";

export const dynamic = "force-dynamic";

async function ownerEmail() {
  return (await auth())?.user?.email?.trim().toLowerCase() || null;
}

export async function GET(request) {
  const email = await ownerEmail();
  if (!email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() || "";
  const archived = params.get("archived") === "true";
  const folderId = params.get("folderId");
  const tag = params.get("tag")?.trim() || "";
  const values = [email, archived];
  let sql = `SELECT id, title, left(content, 240) AS excerpt, tags, folder_id, pinned, archived, created_at, updated_at
    FROM user_notes WHERE user_email = $1 AND archived = $2`;
  if (q) { values.push(`%${q}%`); sql += ` AND (title ILIKE $${values.length} OR content ILIKE $${values.length})`; }
  if (folderId && /^\d+$/.test(folderId)) { values.push(Number(folderId)); sql += ` AND folder_id = $${values.length}`; }
  if (tag) { values.push(tag); sql += ` AND $${values.length} = ANY(tags)`; }
  sql += " ORDER BY pinned DESC, updated_at DESC LIMIT 500";
  try { return NextResponse.json(await query(sql, values)); }
  catch (error) { console.error("Notes list error:", error); return NextResponse.json({ error: "Could not load notes" }, { status: 500 }); }
}

export async function POST(request) {
  const email = await ownerEmail();
  if (!email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!requireCsrf(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.slice(0, 300) : "";
    const content = typeof body.content === "string" ? body.content.slice(0, 500000) : "";
    const tags = Array.isArray(body.tags) ? body.tags.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 30) : [];
    let folderId = body.folder_id ? Number(body.folder_id) : null;
    if (folderId && !(await query("SELECT id FROM note_folders WHERE id=$1 AND user_email=$2", [folderId, email])).length) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    const result = await query(`INSERT INTO user_notes(user_email,title,content,tags,folder_id)
      VALUES($1,$2,$3,$4,$5) RETURNING *`, [email, title, content, tags, folderId]);
    return NextResponse.json(result[0], { status: 201 });
  } catch (error) { console.error("Note create error:", error); return NextResponse.json({ error: "Could not create note" }, { status: 500 }); }
}
