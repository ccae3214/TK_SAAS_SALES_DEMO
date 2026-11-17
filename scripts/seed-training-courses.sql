-- 訓練中心預設課程：CAV 與中文 N1，以及中文 N1 的 8 個課程單元（共 60 小時），含每個單元的詞彙與對話。
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
ALTER TABLE hr_tc_course_units ADD COLUMN IF NOT EXISTS vocabulary TEXT NOT NULL DEFAULT '';
ALTER TABLE hr_tc_course_units ADD COLUMN IF NOT EXISTS dialogue TEXT NOT NULL DEFAULT '';

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

-- 學習內容（詞彙與對話）：只補還沒有內容的單元（詞彙與對話都是空的），不會蓋掉你編輯過的內容。
UPDATE hr_tc_course_units u SET vocabulary = v.vocabulary, dialogue = v.dialogue, updated_at = NOW()
FROM (VALUES
    (E'發音與聲調', E'媽 | mā | mother\n麻 | má | hemp\n馬 | mǎ | horse\n罵 | mà | to scold\n你 | nǐ | you\n好 | hǎo | good\n我 | wǒ | I, me\n他 | tā | he, him\n是 | shì | to be\n不 | bù | not', E'A：你好！ | Nǐ hǎo! | Hello!\nB：你好！ | Nǐ hǎo! | Hello!\nA：謝謝。 | Xièxie. | Thank you.\nB：不客氣。 | Bú kèqi. | You''re welcome.'),
    (E'問候與自我介紹', E'早安 | zǎo ān | good morning\n午安 | wǔ ān | good afternoon\n晚安 | wǎn ān | good night\n名字 | míngzi | name\n叫 | jiào | to be called\n姓 | xìng | surname\n菲律賓 | Fēilǜbīn | the Philippines\n台灣 | Táiwān | Taiwan\n人 | rén | person\n家人 | jiārén | family members\n認識 | rènshi | to meet, to know\n請多指教 | qǐng duō zhǐjiào | please take care of me', E'A：你好，我叫瑪莉亞。 | Nǐ hǎo, wǒ jiào Mǎlìyà. | Hello, my name is Maria.\nB：你好，我姓王。你是哪裡人？ | Nǐ hǎo, wǒ xìng Wáng. Nǐ shì nǎlǐ rén? | Hello, my surname is Wang. Where are you from?\nA：我是菲律賓人。 | Wǒ shì Fēilǜbīn rén. | I am Filipino.\nB：很高興認識你。 | Hěn gāoxìng rènshi nǐ. | Nice to meet you.\nA：請多指教。 | Qǐng duō zhǐjiào. | Please take care of me.'),
    (E'數字、時間、日期', E'一 | yī | one\n二 | èr | two\n三 | sān | three\n十 | shí | ten\n一百 | yìbǎi | one hundred\n點 | diǎn | o''clock\n分 | fēn | minute\n今天 | jīntiān | today\n明天 | míngtiān | tomorrow\n星期一 | xīngqīyī | Monday\n月 | yuè | month\n號 | hào | day of the month\n塊 | kuài | dollar (NT$, informal)', E'A：現在幾點？ | Xiànzài jǐ diǎn? | What time is it now?\nB：現在八點三十分。 | Xiànzài bā diǎn sānshí fēn. | It is 8:30.\nA：今天星期幾？ | Jīntiān xīngqī jǐ? | What day is it today?\nB：今天星期三。 | Jīntiān xīngqī sān. | Today is Wednesday.\nA：明天幾號？ | Míngtiān jǐ hào? | What is the date tomorrow?\nB：明天十號。 | Míngtiān shí hào. | Tomorrow is the 10th.'),
    (E'日常生活', E'吃飯 | chī fàn | to eat a meal\n喝水 | hē shuǐ | to drink water\n買 | mǎi | to buy\n多少錢 | duōshǎo qián | how much\n太貴了 | tài guì le | too expensive\n便宜 | piányí | cheap\n公車 | gōngchē | bus\n捷運 | jiéyùn | MRT (metro)\n車站 | chēzhàn | station\n左轉 | zuǒ zhuǎn | turn left\n右轉 | yòu zhuǎn | turn right\n直走 | zhí zǒu | go straight', E'A：請問，這個多少錢？ | Qǐngwèn, zhège duōshǎo qián? | Excuse me, how much is this?\nB：五十塊。 | Wǔshí kuài. | Fifty dollars.\nA：好，我要買兩個。 | Hǎo, wǒ yào mǎi liǎng ge. | OK, I''ll buy two.\nA：請問車站怎麼走？ | Qǐngwèn chēzhàn zěnme zǒu? | Excuse me, how do I get to the station?\nB：直走，然後右轉。 | Zhí zǒu, ránhòu yòu zhuǎn. | Go straight, then turn right.'),
    (E'住宿與宿舍生活', E'宿舍 | sùshè | dormitory\n房間 | fángjiān | room\n廁所 | cèsuǒ | restroom\n廚房 | chúfáng | kitchen\n洗衣機 | xǐyījī | washing machine\n熱水 | rèshuǐ | hot water\n鑰匙 | yàoshi | key\n壞了 | huài le | broken\n安靜 | ānjìng | quiet\n幫忙 | bāngmáng | to help\n打掃 | dǎsǎo | to clean\n垃圾 | lājī | trash', E'A：請問廁所在哪裡？ | Qǐngwèn cèsuǒ zài nǎlǐ? | Excuse me, where is the restroom?\nB：在二樓。 | Zài èr lóu. | It''s on the second floor.\nA：熱水壞了，可以幫忙嗎？ | Rèshuǐ huài le, kěyǐ bāngmáng ma? | The hot water is broken. Can you help?\nB：好，我現在去看。 | Hǎo, wǒ xiànzài qù kàn. | OK, I''ll go and check now.\nA：謝謝你。 | Xièxie nǐ. | Thank you.'),
    (E'職場基本用語', E'老闆 | lǎobǎn | boss, owner\n主管 | zhǔguǎn | supervisor\n上班 | shàngbān | to go to work\n下班 | xiàbān | to get off work\n請假 | qǐngjià | to ask for leave\n遲到 | chídào | to be late\n開始 | kāishǐ | to start\n休息 | xiūxí | to rest\n危險 | wéixiǎn | dangerous\n小心 | xiǎoxīn | be careful\n安全帽 | ānquánmào | safety helmet\n完成 | wánchéng | to finish\n報告 | bàogào | to report', E'A：早安，今天幾點開始工作？ | Zǎo ān, jīntiān jǐ diǎn kāishǐ gōngzuò? | Good morning, what time do we start work today?\nB：八點開始。請戴安全帽。 | Bā diǎn kāishǐ. Qǐng dài ānquánmào. | We start at eight. Please wear a safety helmet.\nA：對不起，請再說一次。 | Duìbuqǐ, qǐng zài shuō yí cì. | Sorry, please say it again.\nB：八點開始，請戴安全帽。 | Bā diǎn kāishǐ, qǐng dài ānquánmào. | We start at eight, please wear a safety helmet.\nA：我明白了。我想請假一天。 | Wǒ míngbái le. Wǒ xiǎng qǐngjià yì tiān. | I understand. I''d like to take one day off.'),
    (E'身體與緊急狀況', E'頭 | tóu | head\n肚子 | dùzi | stomach, belly\n手 | shǒu | hand\n腳 | jiǎo | foot\n痛 | tòng | pain, to hurt\n發燒 | fāshāo | to have a fever\n咳嗽 | késou | to cough\n看醫生 | kàn yīshēng | to see a doctor\n醫院 | yīyuàn | hospital\n藥 | yào | medicine\n救護車 | jiùhùchē | ambulance\n一一九 | yāo yāo jiǔ | 119 (ambulance and fire in Taiwan)', E'A：我不舒服，肚子很痛。 | Wǒ bù shūfu, dùzi hěn tòng. | I don''t feel well, my stomach hurts a lot.\nB：你發燒嗎？ | Nǐ fāshāo ma? | Do you have a fever?\nA：有，我想看醫生。 | Yǒu, wǒ xiǎng kàn yīshēng. | Yes, I''d like to see a doctor.\nB：我帶你去醫院。 | Wǒ dài nǐ qù yīyuàn. | I''ll take you to the hospital.\nA：請叫救護車！ | Qǐng jiào jiùhùchē! | Please call an ambulance!'),
    (E'複習與結業測驗', E'請問 | qǐngwèn | excuse me (may I ask)\n對不起 | duìbuqǐ | sorry\n沒關係 | méi guānxi | it''s okay\n可以 | kěyǐ | can, may\n不可以 | bù kěyǐ | not allowed\n我要 | wǒ yào | I want\n我不知道 | wǒ bù zhīdào | I don''t know\n請等一下 | qǐng děng yíxià | please wait a moment\n再見 | zàijiàn | goodbye', E'A：請問，我可以今天下午請假嗎？ | Qǐngwèn, wǒ kěyǐ jīntiān xiàwǔ qǐngjià ma? | Excuse me, may I take leave this afternoon?\nB：為什麼？ | Wèishénme? | Why?\nA：我不舒服，要去醫院。 | Wǒ bù shūfu, yào qù yīyuàn. | I don''t feel well and need to go to the hospital.\nB：好，請小心。再見。 | Hǎo, qǐng xiǎoxīn. Zàijiàn. | OK, be careful. Goodbye.\nA：謝謝，再見。 | Xièxie, zàijiàn. | Thank you, goodbye.')
) AS v(name, vocabulary, dialogue), hr_tc_courses co
WHERE u.course_id = co.id AND co.center_id = :center_id AND co.name = 'Mandarin Training (Kolecion)'
  AND u.name = v.name AND u.vocabulary = '' AND u.dialogue = '';

COMMIT;

SELECT c.name AS certification, co.name AS course, co.fee, co.currency, co.hours,
  (SELECT COUNT(*) FROM hr_tc_course_units u WHERE u.course_id = co.id) AS units, co.active
FROM hr_tc_courses co JOIN hr_tc_certifications c ON c.id = co.certification_id
WHERE co.center_id = :center_id ORDER BY co.id;
