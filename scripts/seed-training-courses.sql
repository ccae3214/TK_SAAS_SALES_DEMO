-- 訓練中心預設課程：CAV 與中文 N1，以及中文 N1 的 8 個課程單元（共 60 小時）。
-- 可重複執行：已存在的證照／課程不會被覆蓋；中文 N1 只有在「還沒有任何單元」時才會寫入單元，不會蓋掉你編輯過的內容。
--
-- 用法（在專案資料夾，center_email 換成訓練中心會員的 Email）：
--   Get-Content scripts/seed-training-courses.sql | docker compose exec -T postgres psql -U postgres -d saas_demo -v center_email=center@example.com
--
-- 若網站還沒更新到有「課程費用」欄位的版本，這支腳本也會先補上欄位。
\set ON_ERROR_STOP on

-- 找不到訓練中心就中止，不寫入任何資料。
SELECT COALESCE(max(id), 0) AS center_id FROM hr_members
WHERE role = 'training_center' AND lower(email) = lower(:'center_email') \gset
SELECT :center_id = 0 AS missing_center \gset
\if :missing_center
  \echo '找不到這個 Email 的訓練中心會員（會員類型必須是訓練中心），已中止。'
  \quit
\endif

BEGIN;

ALTER TABLE hr_tc_courses ADD COLUMN IF NOT EXISTS fee NUMERIC(12,2);
ALTER TABLE hr_tc_courses ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'PHP';

CREATE TABLE IF NOT EXISTS hr_tc_course_units (
  id BIGSERIAL PRIMARY KEY,
  center_id BIGINT NOT NULL REFERENCES hr_members(id) ON DELETE CASCADE,
  course_id BIGINT NOT NULL REFERENCES hr_tc_courses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  hours INTEGER,
  topics TEXT NOT NULL DEFAULT '',
  topics_en TEXT NOT NULL DEFAULT '',
  examples TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, name)
);
CREATE INDEX IF NOT EXISTS hr_tc_course_units_course ON hr_tc_course_units(course_id, position);

INSERT INTO hr_tc_certifications(center_id, name)
VALUES (:center_id, 'CAV'), (:center_id, '中文N1')
ON CONFLICT (center_id, name) DO NOTHING;

INSERT INTO hr_tc_courses(center_id, certification_id, name, fee, currency)
SELECT :center_id, c.id, v.course_name, v.fee, 'PHP'
FROM (VALUES
  ('CAV',    'CAV Training (Q8)',             35000),
  ('中文N1', 'Mandarin Training (Kolecion)',  20000)
) AS v(cert_name, course_name, fee)
JOIN hr_tc_certifications c ON c.center_id = :center_id AND c.name = v.cert_name
ON CONFLICT (center_id, certification_id, name) DO NOTHING;

-- 中文 N1 課程：總時數 60 小時（原本沒填才補）；還沒有單元時寫入 8 個單元。
UPDATE hr_tc_courses SET hours = 60, updated_at = NOW()
WHERE center_id = :center_id AND name = 'Mandarin Training (Kolecion)' AND hours IS NULL;

INSERT INTO hr_tc_course_units(center_id, course_id, position, name, name_en, hours, topics, topics_en, examples)
SELECT :center_id, co.id, v.position, v.name, v.name_en, v.hours, v.topics, v.topics_en, v.examples
FROM hr_tc_courses co
CROSS JOIN (VALUES
    (1, E'發音與聲調', E'Pronunciation & Tones', 8, E'拼音、四個聲調、常見易混的音', E'Pinyin, the four tones, and commonly confused sounds', E'你好 | Nǐ hǎo | Hello.\n謝謝 | Xièxie | Thank you.'),
    (2, E'問候與自我介紹', E'Greetings & Introductions', 6, E'打招呼、姓名、國籍、家人', E'Greetings, names, nationality, family', E'我叫瑪莉亞。 | Wǒ jiào Mǎlìyà. | My name is Maria.\n我是菲律賓人。 | Wǒ shì Fēilǜbīn rén. | I am Filipino.'),
    (3, E'數字、時間、日期', E'Numbers, Time & Dates', 6, E'數字、幾點、星期、月份、金額', E'Numbers, telling time, days of the week, months, amounts of money', E'現在幾點？ | Xiànzài jǐ diǎn? | What time is it now?\n今天星期幾？ | Jīntiān xīngqī jǐ? | What day is it today?'),
    (4, E'日常生活', E'Daily Life', 8, E'飲食、購物、問價、搭車、問路', E'Food, shopping, asking prices, transport, asking for directions', E'這個多少錢？ | Zhège duōshǎo qián? | How much is this?\n我要去車站。 | Wǒ yào qù chēzhàn. | I want to go to the station.'),
    (5, E'住宿與宿舍生活', E'Housing & Dormitory', 6, E'房間、設備、宿舍規則、請人幫忙', E'Rooms, facilities, dormitory rules, asking for help', E'廁所在哪裡？ | Cèsuǒ zài nǎlǐ? | Where is the restroom?\n我的房間在二樓。 | Wǒ de fángjiān zài èr lóu. | My room is on the second floor.'),
    (6, E'職場基本用語', E'Workplace Basics', 10, E'聽懂指令、請對方再說一次、安全警告、請假、向主管回報', E'Understanding instructions, asking someone to repeat, safety warnings, asking for leave, reporting to a supervisor', E'請再說一次。 | Qǐng zài shuō yí cì. | Please say it again.\n我不懂，請慢一點。 | Wǒ bù dǒng, qǐng màn yìdiǎn. | I don''t understand, please slow down.\n小心！ | Xiǎoxīn! | Be careful!'),
    (7, E'身體與緊急狀況', E'Health & Emergencies', 10, E'身體部位、症狀、看醫生、叫救護車、照護基本詞彙', E'Body parts, symptoms, seeing a doctor, calling an ambulance, basic caregiving vocabulary', E'我不舒服。 | Wǒ bù shūfu. | I don''t feel well.\n我頭痛。 | Wǒ tóu tòng. | I have a headache.\n請叫救護車。 | Qǐng jiào jiùhùchē. | Please call an ambulance.'),
    (8, E'複習與結業測驗', E'Review & Assessment', 6, E'情境演練、筆試、口說測驗', E'Scenario practice, written test, speaking test', E'')
) AS v(position, name, name_en, hours, topics, topics_en, examples)
WHERE co.center_id = :center_id AND co.name = 'Mandarin Training (Kolecion)'
  AND NOT EXISTS (SELECT 1 FROM hr_tc_course_units u WHERE u.course_id = co.id);

COMMIT;

SELECT c.name AS certification, co.name AS course, co.fee, co.currency, co.hours,
  (SELECT COUNT(*) FROM hr_tc_course_units u WHERE u.course_id = co.id) AS units, co.active
FROM hr_tc_courses co JOIN hr_tc_certifications c ON c.id = co.certification_id
WHERE co.center_id = :center_id ORDER BY co.id;
