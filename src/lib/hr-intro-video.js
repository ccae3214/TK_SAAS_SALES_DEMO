// 工作者介紹影片的內容與時間軸（純資料與純函式，不依賴 React，方便用 node 測試）。
// 影片是網站內建的動畫導覽：每個場景有標題與說明（中英文），依序自動播放。
// 場景的畫面在 components/HrIntroVideo.jsx，用 id 對應。
// 如果之後錄了真正的影片，放到 public/videos/ 底下就會優先播放（見 INTRO_VIDEO_FILES）。

const T = (zh, en) => ({ zh, en });

// 真實影片檔（選用）：檔案存在時優先播放，不存在就播放內建動畫。
export const INTRO_VIDEO_FILES = {
  zh: '/videos/worker-intro-zh.mp4',
  en: '/videos/worker-intro-en.mp4',
};

export const INTRO_VIDEO_SCENES = [
  { id: 'welcome', duration: 6000,
    title: T('歡迎使用克雷迅人力管理', 'Welcome to Kolecion HR'),
    caption: T('這支約一分鐘的影片，帶你認識怎麼使用：申請、審核、開始使用。', 'This one-minute video shows you how to use the site: apply, get approved, then start.') },
  { id: 'apply', duration: 7000,
    title: T('第一步：申請會員', 'Step 1: Apply for membership'),
    caption: T('選擇會員類型「工作者」和你的仲介，再按「送出」。管理者審核通過後就能使用。', 'Choose the member type "Worker" and your agency, then press Submit. You can start once the administrator approves you.') },
  { id: 'start', duration: 6000,
    title: T('工作起點', 'Start here'),
    caption: T('每次進來先看「工作起點」，系統會告訴你現在最需要做的下一件事。', 'Always check "Start here" first. It tells you the most important next thing to do.') },
  { id: 'basic', duration: 7000,
    title: T('基本資料', 'Basic information'),
    caption: T('填寫履歷並上傳照片。資料越完整，仲介越容易幫你配對工作。', 'Fill in your resume and upload your photo. The more complete it is, the easier it is for your agency to match you with a job.') },
  { id: 'documents', duration: 8000,
    title: T('必要文件', 'Required documents'),
    caption: T('依清單上傳每一項文件。如果文件被退回，請依說明重新上傳。', 'Upload each document on the list. If a document is returned, upload it again following the instructions.') },
  { id: 'process', duration: 6000,
    title: T('來台程序', 'Process to Taiwan'),
    caption: T('在這裡查看目前進行到哪個階段，以及接下來要做的事。', 'See which stage you are at and what comes next.') },
  { id: 'training', duration: 7000,
    title: T('訓練課程', 'Training courses'),
    caption: T('文件核准後，訓練中心或仲介會為你安排班別。你也可以跟著課程學中文，並播放發音。', 'After your documents are approved, the training center or agency arranges your class. You can also study Chinese lessons and play the pronunciation.') },
  { id: 'chat', duration: 6000,
    title: T('聊天室', 'Chat'),
    caption: T('有問題時，在聊天室和仲介與相關人員聯絡。', 'If you have a question, contact your agency and the people involved in the chat.') },
  { id: 'tips', duration: 7000,
    title: T('小提醒', 'Quick tips'),
    caption: T('畫面上方可以切換中文與英文。想再看一次導覽，按左下角的「使用導覽」。', 'Switch between Chinese and English at the top of the page. To see the tour again, press "Quick tour" at the bottom left.') },
];

export const INTRO_VIDEO_DURATION = INTRO_VIDEO_SCENES.reduce((sum, scene) => sum + scene.duration, 0);

const normalizeLang = lang => (lang === 'en' ? 'en' : 'zh');

// 每個場景開始的時間（毫秒）。
export const INTRO_SCENE_STARTS = INTRO_VIDEO_SCENES.map((_, index) => INTRO_VIDEO_SCENES.slice(0, index).reduce((sum, scene) => sum + scene.duration, 0));

// 播放到 elapsed 毫秒時，目前是第幾個場景（超過結尾就停在最後一個）。
export function sceneIndexAt(elapsed) {
  const time = Math.max(0, Number(elapsed) || 0);
  for (let index = INTRO_VIDEO_SCENES.length - 1; index >= 0; index -= 1) {
    if (time >= INTRO_SCENE_STARTS[index]) return index;
  }
  return 0;
}

// 介面文字。
export const INTRO_VIDEO_TEXT = {
  zh: {
    open: '介紹影片', dialog: '介紹影片', close: '關閉', play: '播放', pause: '暫停', replay: '重新播放',
    previous: '上一段', next: '下一段', progress: '播放進度', scenes: '影片章節', scene: '第 {n} 段', loading: '載入中…',
  },
  en: {
    open: 'Intro video', dialog: 'Intro video', close: 'Close', play: 'Play', pause: 'Pause', replay: 'Replay',
    previous: 'Previous', next: 'Next', progress: 'Playback progress', scenes: 'Video chapters', scene: 'Part {n}', loading: 'Loading…',
  },
};

export const introVideoText = lang => INTRO_VIDEO_TEXT[normalizeLang(lang)];
