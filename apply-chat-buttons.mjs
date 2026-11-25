// 在聊天室（src/components/HrChat.jsx）加上「語音通話」「視訊通話」按鈕。
// 用短字串精確取代：任何一處找不到或找到多處就停下來，不會改壞檔案。可重複執行（已加過會直接結束）。
import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('./src/components/HrChat.jsx', import.meta.url);
const original = await readFile(path, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
let source = original.replace(/\r\n/g, '\n');

if (source.includes("new CustomEvent('hr:start-call'")) { console.log('HrChat.jsx 已經有通話按鈕，不需要再改。'); process.exit(0); }

const edits = [
  ["import { MessageCircle, RefreshCw, Send, Users } from 'lucide-react';",
    "import { MessageCircle, Phone, RefreshCw, Send, Users, Video } from 'lucide-react';"],
  ["  const selectedRoom=rooms.find(room=>room.id===selectedRoomId);\n",
    `  const selectedRoom=rooms.find(room=>room.id===selectedRoomId);
  // 通話：只發出事件，由 HrCallProvider（整個 /hr 頁面一個）負責撥號與通話視窗。
  const callText=lang==='en'?{voice:'Voice call',video:'Video call'}:{voice:'語音通話',video:'視訊通話'};
  const startCall=video=>{if(selectedRoomId)window.dispatchEvent(new CustomEvent('hr:start-call',{detail:{roomId:selectedRoomId,video,title:selectedRoom?.title||''}}));};
`],
  ["{selectedRoom&&selectedRoom.roomType!=='direct'&&<button type=\"button\" className={styles.memberToggle}",
    "{selectedRoom&&<div className=\"hr-call-actions\"><button type=\"button\" className=\"hr-call-start\" onClick={()=>startCall(false)}><Phone size={16}/>{callText.voice}</button><button type=\"button\" className=\"hr-call-start\" onClick={()=>startCall(true)}><Video size={16}/>{callText.video}</button>{selectedRoom.roomType!=='direct'&&<button type=\"button\" className={styles.memberToggle}"],
  ["{text.members} ({members.length})</button>}</div>",
    "{text.members} ({members.length})</button>}</div>}</div>"],
];

for (const [from, to] of edits) {
  const count = source.split(from).length - 1;
  if (count !== 1) { console.error(`找不到唯一的位置（找到 ${count} 處）：${from.slice(0, 70)}…\n沒有修改任何檔案，請把這段訊息貼給我。`); process.exit(1); }
  source = source.replace(from, () => to);
}
await writeFile(path, source.replace(/\n/g, eol));
console.log('已在 HrChat.jsx 加上語音與視訊通話按鈕。');
