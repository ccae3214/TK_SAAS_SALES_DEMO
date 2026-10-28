"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, Check, ChevronDown, FileText, Folder, FolderPlus, Menu, Pin, Plus, Search, Trash2, X } from "lucide-react";
import styles from "./NotesWorkspace.module.css";

async function request(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "請求失敗，請稍後再試");
  return payload;
}
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function renderMarkdown(source = "") {
  return escapeHtml(source).split("\n").map((line) => {
    if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
    if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
    if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
    if (line.startsWith("> ")) return `<blockquote>${line.slice(2)}</blockquote>`;
    if (/^[-*] /.test(line)) return `<li>${line.slice(2)}</li>`;
    return line ? `<p>${line}</p>` : "<br />";
  }).join("").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>").replace(/\*(.+?)\*/g, "<em>$1</em>");
}
const dateLabel = (value) => value ? new Date(value).toLocaleDateString("zh-TW", { month: "short", day: "numeric" }) : "";

export default function NotesWorkspace({ email }) {
  const router = useRouter();
  const [csrf, setCsrf] = useState("");
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [active, setActive] = useState(null);
  const [view, setView] = useState("all");
  const [folderFilter, setFolderFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [preview, setPreview] = useState(false);
  const [mobileEditing, setMobileEditing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState("已同步");
  const [error, setError] = useState("");
  const timer = useRef(null);

  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-csrf-token": csrf }), [csrf]);
  const load = useCallback(async () => {
    try {
      const archived = view === "archived";
      const params = new URLSearchParams({ archived: String(archived) });
      if (search.trim()) params.set("q", search.trim());
      if (folderFilter) params.set("folderId", String(folderFilter));
      if (tagFilter) params.set("tag", tagFilter);
      const [nextNotes, nextFolders] = await Promise.all([request(`/api/notes?${params}`), request("/api/notes/folders")]);
      setNotes(nextNotes); setFolders(nextFolders); setError("");
      localStorage.setItem(`notes-list:${email}`, JSON.stringify(nextNotes));
      localStorage.setItem(`notes-folders:${email}`, JSON.stringify(nextFolders));
    } catch (cause) {
      const cachedNotes = localStorage.getItem(`notes-list:${email}`);
      const cachedFolders = localStorage.getItem(`notes-folders:${email}`);
      if (cachedNotes) { setNotes(JSON.parse(cachedNotes)); setFolders(cachedFolders ? JSON.parse(cachedFolders) : []); setStatus("離線暫存"); }
      else setError(cause.message);
    }
  }, [view, search, folderFilter, tagFilter]);

  useEffect(() => {
    request("/api/csrf").then((data) => setCsrf(data.csrfToken)).catch((cause) => setError(cause.message));
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const visibleNotes = view === "pinned" ? notes.filter((note) => note.pinned) : notes;
  const viewTitle = folderFilter ? folders.find((item) => item.id === folderFilter)?.name || "資料夾" : ({ all: "所有筆記", pinned: "已釘選", archived: "封存" }[view]);

  async function save(note = active) {
    if (!note || !csrf) return;
    setStatus("儲存中…");
    try {
      const saved = await request(`/api/notes/${note.id}`, { method: "PUT", headers, body: JSON.stringify(note) });
      setActive(saved);
      setNotes((current) => current.map((item) => item.id === saved.id ? { ...item, ...saved, excerpt: saved.content.slice(0, 240) } : item));
      localStorage.removeItem(`note-pending:${email}:${saved.id}`);
      localStorage.setItem(`note-cache:${email}:${saved.id}`, JSON.stringify(saved));
      setStatus("已儲存"); setError("");
    } catch {
      localStorage.setItem(`note-pending:${email}:${note.id}`, JSON.stringify(note));
      localStorage.setItem(`note-cache:${email}:${note.id}`, JSON.stringify(note));
      setStatus("離線暫存");
    }
  }
  function edit(field, value) {
    const next = { ...active, [field]: value };
    setActive(next); setStatus("儲存中…");
    localStorage.setItem(`note-pending:${email}:${next.id}`, JSON.stringify(next));
    localStorage.setItem(`note-cache:${email}:${next.id}`, JSON.stringify(next));
    clearTimeout(timer.current); timer.current = setTimeout(() => save(next), 650);
  }
  async function createNote() {
    if (!csrf) return;
    try {
      const note = await request("/api/notes", { method: "POST", headers, body: JSON.stringify({ title: "", content: "", tags: [], folder_id: folderFilter }) });
      setView("all"); setActive(note); setMobileEditing(true); setNotes((current) => [note, ...current]); setSidebarOpen(false);
    } catch (cause) { setError(cause.message); }
  }
  async function selectNote(note) {
    if (active) await save(active);
    try { const selected = await request(`/api/notes/${note.id}`); setActive(selected); localStorage.setItem(`note-cache:${email}:${selected.id}`, JSON.stringify(selected)); setMobileEditing(true); setSidebarOpen(false); setPreview(false); }
    catch {
      const cached = localStorage.getItem(`note-pending:${email}:${note.id}`) || localStorage.getItem(`note-cache:${email}:${note.id}`);
      if (cached) { setActive(JSON.parse(cached)); setMobileEditing(true); setSidebarOpen(false); setPreview(false); setStatus("離線暫存"); }
      else setError("這篇筆記目前無法離線載入");
    }
  }
  async function setPinned() {
    if (!active) return;
    const updated = { ...active, pinned: !active.pinned }; setActive(updated); await save(updated);
  }
  async function setArchived() {
    if (!active) return;
    const updated = { ...active, archived: !active.archived };
    await save(updated); setActive(null); setMobileEditing(false); await load();
  }
  async function deleteActive() {
    if (!active || !window.confirm("確定永久刪除這篇筆記？")) return;
    try { await request(`/api/notes/${active.id}`, { method: "DELETE", headers }); setActive(null); setMobileEditing(false); await load(); }
    catch (cause) { setError(cause.message); }
  }
  async function addFolder() {
    const name = window.prompt("資料夾名稱");
    if (!name?.trim()) return;
    try { await request("/api/notes/folders", { method: "POST", headers, body: JSON.stringify({ name: name.trim() }) }); await load(); }
    catch (cause) { setError(cause.message); }
  }
  async function removeFolder(id) {
    if (!window.confirm("刪除資料夾？筆記會移至未分類。")) return;
    try { await request(`/api/notes/folders?id=${id}`, { method: "DELETE", headers }); setFolderFilter(null); await load(); }
    catch (cause) { setError(cause.message); }
  }
  useEffect(() => {
    const syncPending = async () => {
      if (!navigator.onLine || !csrf) return;
      const prefix = `note-pending:${email}:`;
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(prefix)) continue;
        try {
          const note = JSON.parse(localStorage.getItem(key));
          await request(`/api/notes/${note.id}`, { method: "PUT", headers, body: JSON.stringify(note) });
          localStorage.removeItem(key); index -= 1;
        } catch { setStatus("等待同步"); return; }
      }
      setStatus("已同步"); load();
    };
    window.addEventListener("online", syncPending);
    syncPending();
    return () => window.removeEventListener("online", syncPending);
  }, [csrf, email, headers, load]);

  return <div className={`${styles.shell} ${mobileEditing ? styles.editing : ""}`}>
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
      <div className={styles.brand}><span className={styles.logo}>箋</span><div><b>小箋</b><small>PERSONAL NOTES</small></div><button className={styles.close} onClick={() => setSidebarOpen(false)} aria-label="關閉選單"><X size={18} /></button></div>
      <button className={styles.newButton} onClick={createNote}><Plus size={17} /> 新增筆記</button>
      <label className={styles.search}><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋筆記…" /></label>
      <nav className={styles.nav}>
        {[ ["all", "所有筆記", FileText], ["pinned", "已釘選", Pin], ["archived", "封存", Archive] ].map(([id, label, Icon]) => <button key={id} className={`${styles.navItem} ${view === id && !folderFilter ? styles.selected : ""}`} onClick={() => { setView(id); setFolderFilter(null); setTagFilter(""); }}><Icon size={16} />{label}<span>{id === "all" ? notes.filter((note) => !note.archived).length : ""}</span></button>)}
      </nav>
      <div className={styles.sectionHead}><span>資料夾</span><button onClick={addFolder} aria-label="新增資料夾"><FolderPlus size={16} /></button></div>
      <div className={styles.folderList}>{folders.map((item) => <div key={item.id} className={`${styles.folderRow} ${folderFilter === item.id ? styles.selected : ""}`}><button onClick={() => { setFolderFilter(item.id); setView("all"); }}><Folder size={14} />{item.name}</button><button className={styles.folderDelete} onClick={() => removeFolder(item.id)} aria-label={`刪除資料夾 ${item.name}`}><X size={13} /></button></div>)}</div>
      <div className={styles.account}><span className={styles.avatar}>{email?.[0]?.toUpperCase()}</span><span><b>{email}</b><small>以網站帳號同步</small></span><button onClick={() => signIn("google", { callbackUrl: "/notes" })}>↗</button></div>
    </aside>
    {sidebarOpen && <button className={styles.scrim} onClick={() => setSidebarOpen(false)} aria-label="關閉選單" />}
    <main className={styles.main}>
      <header className={styles.topbar}><button className={styles.menu} onClick={() => setSidebarOpen(true)} aria-label="開啟選單"><Menu size={19} /></button><Link href="/" className={styles.back}><ArrowLeft size={15} /> 回到首頁</Link><span className={styles.crumb}>{viewTitle}{active ? ` / ${active.title || "未命名筆記"}` : ""}</span><div className={styles.actions}><span className={styles.status}><Check size={13} />{status}</span><button onClick={setPinned} disabled={!active} title="釘選"><Pin size={16} /></button><button onClick={setArchived} disabled={!active} title="封存"><Archive size={16} /></button><button onClick={deleteActive} disabled={!active} title="刪除"><Trash2 size={16} /></button></div></header>
      <div className={styles.workspace}>
        <section className={styles.listPane}><div className={styles.listTitle}><span>YOUR LIBRARY</span><h1>{viewTitle}<small>{visibleNotes.length}</small></h1></div>
          <div className={styles.tagBar}>{[...new Set(notes.flatMap((note) => note.tags || []))].map((tag) => <button key={tag} className={tagFilter === tag ? styles.tagActive : ""} onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}># {tag}</button>)}</div>
          <div className={styles.notesList}>{visibleNotes.map((note) => <button key={note.id} onClick={() => selectNote(note)} className={`${styles.noteCard} ${active?.id === note.id ? styles.noteActive : ""}`}><b>{note.title || "未命名筆記"}{note.pinned && <Pin size={12} />}</b><span>{note.excerpt || "還沒有內容…"}</span><small>{dateLabel(note.updated_at)}{note.tags?.slice(0, 2).map((tag) => <i key={tag}>{tag}</i>)}</small></button>)}{!visibleNotes.length && <div className={styles.empty}><FileText size={23} /><b>這裡還沒有筆記</b><button onClick={createNote}>寫下第一篇</button></div>}</div>
        </section>
        <section className={styles.editor}>{active ? <div className={styles.editorInner}><div className={styles.editorMeta}><select value={active.folder_id || ""} onChange={(event) => edit("folder_id", event.target.value ? Number(event.target.value) : null)}><option value="">未分類</option>{folders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className={styles.grow} />{dateLabel(active.updated_at)}<button className={styles.mobileBack} onClick={() => setMobileEditing(false)}>← 列表</button></div><input className={styles.title} value={active.title || ""} onChange={(event) => edit("title", event.target.value)} placeholder="無標題" maxLength={300} /><input className={styles.tags} value={(active.tags || []).join(", ")} onChange={(event) => edit("tags", event.target.value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 30))} placeholder="標籤，以逗號分隔" /><div className={styles.tabs}><button className={!preview ? styles.tabActive : ""} onClick={() => setPreview(false)}>編輯</button><button className={preview ? styles.tabActive : ""} onClick={() => setPreview(true)}>預覽</button><span>Markdown</span></div>{preview ? <div className={styles.preview} dangerouslySetInnerHTML={{ __html: renderMarkdown(active.content) }} /> : <textarea className={styles.content} value={active.content || ""} onChange={(event) => edit("content", event.target.value)} placeholder="開始記下你的想法…" />}</div> : <div className={styles.blank}><div>✳</div><h2>留一點空間給想法</h2><p>選一篇筆記，或建立新的筆記。</p><button onClick={createNote}><Plus size={15} /> 新增筆記</button></div>}</section>
      </div>
      {error && <div className={styles.error} role="status">{error}<button onClick={() => setError("")}><X size={14} /></button></div>}
    </main>
  </div>;
}
