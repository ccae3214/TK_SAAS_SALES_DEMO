// 中文 A1 課程（菲律賓移工版）單元 1–5。每行：中文 | 拼音 | English | Filipino
// 改完執行 node scripts/build-mandarin-a1-course.mjs 重新產生 SQL 與 Filipino 字典，再跑 node scripts/check-mandarin-pinyin.mjs。
export default [
  {
    position: 1, hours: 10,
    name: '發音與聲調', name_en: 'Pronunciation & Tones', name_tl: 'Bigkas at mga Tono',
    category: '基礎', category_en: 'Basics', category_tl: 'Mga Batayan',
    topics: '目標：分辨四個聲調與輕聲、看懂拼音、會說課堂用語。發音：一聲高而平，二聲往上揚，三聲先降再升，四聲快速往下，輕聲短而輕（的、嗎、了不標聲調）。變調：兩個三聲相連，前一個唸二聲，拼音照標原調（你好 nǐ hǎo 唸 ní hǎo）；「不」在四聲前唸 bú（不是 bú shì），其他唸 bù；「一」在四聲前唸 yí（一次 yí cì），在一、二、三聲前唸 yì（一天 yì tiān），單唸、數數、序數唸 yī（第一 dì-yī）。拼寫：j、q、x、y 後面的 ü 寫成 u（去 qù），n、l 後面寫 ü（女 nǚ、綠 lǜ）；a、o、e 開頭的音節接在後面要加隔音符號（晚安 wǎn\'ān）。zh、ch、sh、r 要捲舌，z、c、s 不捲舌。文化：在台灣上課先說「老師好」，聽不懂就說「請再說一次」，不必不好意思。',
    topics_en: 'Goals: hear the four tones and the neutral tone, read pinyin, use classroom phrases. Tones: 1st high and level, 2nd rising, 3rd dipping, 4th falling fast; the neutral tone is short and light and has no mark (的, 嗎, 了). Tone changes: two 3rd tones together, the first is said as a 2nd tone but still written as 3rd (nǐ hǎo is said ní hǎo); 不 is bú before a 4th tone (bú shì), otherwise bù; 一 is yí before a 4th tone (yí cì), yì before 1st, 2nd and 3rd tones (yì tiān), and yī alone, in counting and ordinals (dì-yī). Spelling: after j, q, x, y the ü is written u (qù); after n and l write ü (nǚ, lǜ); put an apostrophe before a syllable starting with a, o or e (wǎn\'ān). Curl the tongue for zh, ch, sh, r but not for z, c, s. Culture: greet the teacher with 老師好 and say 請再說一次 when you do not understand.',
    topics_tl: 'Layunin: makilala ang apat na tono at ang neutral na tono, mabasa ang pinyin, at magamit ang mga salita sa klase. Tono: ika-1 mataas at pantay, ika-2 paakyat, ika-3 pababa saka paakyat, ika-4 mabilis na pababa; ang neutral na tono ay maikli at magaan at walang marka (的, 嗎, 了). Pagbabago ng tono: kapag magkasunod ang dalawang ika-3 tono, ang una ay binibigkas na ika-2 pero isinusulat pa ring ika-3 (nǐ hǎo ay binibigkas na ní hǎo); ang 不 ay bú bago ang ika-4 na tono (bú shì), bù sa iba; ang 一 ay yí bago ang ika-4 na tono (yí cì), yì bago ang ika-1, ika-2 at ika-3 (yì tiān), at yī kapag mag-isa, nagbibilang o pang-ilan (dì-yī). Baybay: pagkatapos ng j, q, x, y ang ü ay isinusulat na u (qù); pagkatapos ng n at l isulat ang ü (nǚ, lǜ); maglagay ng kudlit bago ang pantig na nagsisimula sa a, o, e (wǎn\'ān). Ibaluktot ang dila sa zh, ch, sh, r pero hindi sa z, c, s. Kultura: batiin ang guro ng 老師好 at sabihin ang 請再說一次 kapag hindi naintindihan.',
    examples: `你好。 | Nǐ hǎo. | Hello. (3rd + 3rd tone: say ní hǎo) | Kumusta. (ika-3 + ika-3 na tono: bigkasin na ní hǎo)
我很好。 | Wǒ hěn hǎo. | I am fine. (say wó hén hǎo) | Mabuti ako. (bigkasin na wó hén hǎo)
不是。 | Bú shì. | No, it is not. (不 becomes bú before a 4th tone) | Hindi po. (ang 不 ay nagiging bú bago ang ika-4 na tono)
請再說一次。 | Qǐng zài shuō yí cì. | Please say it again. (一 becomes yí before a 4th tone) | Pakiulit po. (ang 一 ay nagiging yí bago ang ika-4 na tono)
請說慢一點。 | Qǐng shuō màn yìdiǎn. | Please speak a little slower. (一 becomes yì before a 3rd tone) | Pakibagalan po ang pagsasalita. (ang 一 ay nagiging yì bago ang ika-3 na tono)`,
    vocabulary: `媽 | mā | mother (1st tone) | nanay (ika-1 tono)
麻 | má | hemp (2nd tone) | abaka (ika-2 tono)
馬 | mǎ | horse (3rd tone) | kabayo (ika-3 tono)
罵 | mà | to scold (4th tone) | pagalitan (ika-4 tono)
嗎 | ma | question particle (neutral tone) | pananong na salita (neutral na tono)
湯 | tāng | soup | sabaw
糖 | táng | sugar | asukal
躺 | tǎng | to lie down | humiga
燙 | tàng | very hot to the touch | napakainit kapag hinawakan
書 | shū | book | libro
熟 | shú | cooked | luto na
水 | shuǐ | water | tubig
睡 | shuì | to sleep | matulog
你 | nǐ | you | ikaw
好 | hǎo | good | mabuti
我 | wǒ | I; me | ako
他 | tā | he; him | siya (lalaki)
她 | tā | she; her | siya (babae)
是 | shì | to be; yes | ay; oo
不 | bù | not; no | hindi
女 | nǚ | female | babae
綠 | lǜ | green | berde
去 | qù | to go | pumunta
魚 | yú | fish | isda
雨 | yǔ | rain | ulan
吃 | chī | to eat | kumain
喝 | hē | to drink | uminom
請 | qǐng | please | pakiusap
請問 | qǐngwèn | excuse me, may I ask | mawalang-galang na po, puwedeng magtanong
懂 | dǒng | to understand | maintindihan
聽 | tīng | to listen | makinig
說 | shuō | to speak; to say | magsalita; sabihin
再 | zài | again | ulit
慢 | màn | slow | mabagal
老師 | lǎoshī | teacher | guro
同學 | tóngxué | classmate | kaklase`,
    dialogue: `A：老師好！ | Lǎoshī hǎo! | Hello, teacher! | Magandang araw po, titser!
B：同學好！請聽。 | Tóngxué hǎo! Qǐng tīng. | Hello, class! Please listen. | Magandang araw, mga estudyante! Makinig kayo.
A：老師，對不起，我聽不懂。 | Lǎoshī, duìbuqǐ, wǒ tīng bù dǒng. | Teacher, sorry, I do not understand. | Titser, pasensya na po, hindi ko po naintindihan.
B：沒問題。我說慢一點。 | Méi wèntí. Wǒ shuō màn yìdiǎn. | No problem. I will speak more slowly. | Walang problema. Babagalan ko ang pagsasalita.
A：請再說一次。 | Qǐng zài shuō yí cì. | Please say it again. | Pakiulit po.
B：媽、麻、馬、罵。 | Mā, má, mǎ, mà. | mā, má, mǎ, mà: the four tones. | mā, má, mǎ, mà: ang apat na tono.
A：媽、麻、馬、罵。 | Mā, má, mǎ, mà. | mā, má, mǎ, mà (repeating). | mā, má, mǎ, mà (inuulit).
B：很好！ | Hěn hǎo! | Very good! | Napakahusay!
A：謝謝老師！ | Xièxie lǎoshī! | Thank you, teacher! | Salamat po, titser!
B：不客氣。 | Bú kèqì. | You are welcome. | Walang anuman.`,
  },
  {
    position: 2, hours: 10,
    name: '問候、禮貌與自我介紹', name_en: 'Greetings, Politeness & Introductions', name_tl: 'Pagbati, Paggalang at Pagpapakilala',
    category: '基礎', category_en: 'Basics', category_tl: 'Mga Batayan',
    topics: '目標：會打招呼、道謝與道歉；會說自己的名字、國籍和工作；會稱呼雇主家人。句型：我是＋國籍／工作（我是菲律賓人）、我叫＋名字、你叫什麼名字？、……呢？。發音：「不客氣」的「不」在四聲前唸 bú；「不好意思」的「不」在三聲前唸 bù；「早安」「晚安」要寫隔音符號 zǎo\'ān、wǎn\'ān。台灣讀音：「誰」多唸 shéi。文化：台灣人見面不一定握手，點頭微笑就很有禮貌；麻煩別人或要開口問問題時，先說「不好意思」；稱呼長輩用「阿公」「阿嬤」，稱呼雇主用「先生」「太太」「老闆」。',
    topics_en: 'Goals: greet people, say thank you and sorry, say your name, nationality and job, and address your employer\'s family. Patterns: 我是 + nationality or job (我是菲律賓人), 我叫 + name, 你叫什麼名字？, ……呢？. Pronunciation: 不 in 不客氣 is bú before a 4th tone; 不 in 不好意思 is bù before a 3rd tone; write the apostrophe in zǎo\'ān and wǎn\'ān. Taiwan reading: 誰 is usually shéi. Culture: people in Taiwan often nod and smile instead of shaking hands; say 不好意思 before you ask for help or a favor; call older people 阿公 and 阿嬤, and your employer 先生, 太太 or 老闆.',
    topics_tl: 'Layunin: bumati, magpasalamat at humingi ng paumanhin, sabihin ang iyong pangalan, nasyonalidad at trabaho, at tawagin nang tama ang pamilya ng amo. Pattern: 我是 + nasyonalidad o trabaho (我是菲律賓人), 我叫 + pangalan, 你叫什麼名字？, ……呢？. Bigkas: ang 不 sa 不客氣 ay bú bago ang ika-4 na tono; ang 不 sa 不好意思 ay bù bago ang ika-3 na tono; isulat ang kudlit sa zǎo\'ān at wǎn\'ān. Bigkas sa Taiwan: ang 誰 ay karaniwang shéi. Kultura: sa Taiwan, madalas tumango at ngumiti sa halip na makipagkamay; sabihin ang 不好意思 bago humingi ng tulong o magtanong; tawagin ang matatanda na 阿公 at 阿嬤, at ang amo na 先生, 太太 o 老闆.',
    examples: `我是菲律賓人。 | Wǒ shì Fēilǜbīnrén. | I am Filipino. | Pilipino ako.
我叫安娜。 | Wǒ jiào Ānnà. | My name is Anna. | Ang pangalan ko ay Anna.
我不是台灣人。 | Wǒ bú shì Táiwānrén. | I am not Taiwanese. | Hindi ako Taiwanese.
你叫什麼名字？ | Nǐ jiào shénme míngzi? | What is your name? | Ano ang pangalan mo?
我是看護，她是幫傭。 | Wǒ shì kānhù, tā shì bāngyōng. | I am a caregiver, she is a domestic helper. | Caregiver ako, kasambahay naman siya.`,
    vocabulary: `你好 | nǐ hǎo | hello | kumusta
您好 | nín hǎo | hello (polite) | magandang araw po
早安 | zǎo'ān | good morning | magandang umaga
午安 | wǔ'ān | good afternoon | magandang hapon
晚安 | wǎn'ān | good night | magandang gabi
歡迎 | huānyíng | welcome | maligayang pagdating
謝謝 | xièxie | thank you | salamat
不客氣 | bú kèqì | you are welcome | walang anuman
對不起 | duìbuqǐ | sorry | pasensya na; patawad
沒關係 | méi guānxì | it is okay | okay lang; walang problema
不好意思 | bù hǎoyìsi | excuse me (sorry to bother you) | pasensya na po sa abala
再見 | zàijiàn | goodbye | paalam
明天見 | míngtiān jiàn | see you tomorrow | kita tayo bukas
名字 | míngzi | name | pangalan
姓 | xìng | surname; to be surnamed | apelyido
貴姓 | guìxìng | your surname (polite) | ang inyong apelyido po
叫 | jiào | to be called | tinatawag; ang pangalan ay
什麼 | shénme | what | ano
誰 | shéi | who | sino
哪 | nǎ | which | alin
國家 | guójiā | country | bansa
菲律賓 | Fēilǜbīn | the Philippines | Pilipinas
台灣 | Táiwān | Taiwan | Taiwan
印尼 | Yìnní | Indonesia | Indonesia
越南 | Yuènán | Vietnam | Vietnam
泰國 | Tàiguó | Thailand | Thailand
人 | rén | person | tao
菲律賓人 | Fēilǜbīnrén | Filipino (person) | Pilipino
台灣人 | Táiwānrén | Taiwanese (person) | Taiwanese
朋友 | péngyǒu | friend | kaibigan
工作 | gōngzuò | job; to work | trabaho; magtrabaho
移工 | yígōng | migrant worker | migranteng manggagawa
看護 | kānhù | caregiver | tagapag-alaga; caregiver
幫傭 | bāngyōng | domestic helper | kasambahay
作業員 | zuòyèyuán | factory operator | operator sa pabrika
農工 | nónggōng | farm worker | manggagawa sa bukid
先生 | xiānshēng | Mr.; sir; husband | Ginoo; Sir; asawang lalaki
小姐 | xiǎojiě | Miss; Ms. | Binibini; Miss
太太 | tàitai | Mrs.; madam | Ginang; Ma'am
阿公 | āgōng | grandpa | lolo
阿嬤 | āmà | grandma | lola
老闆 | lǎobǎn | boss | amo; boss
雇主 | gùzhǔ | employer | employer; amo
很 | hěn | very | napaka-
高興 | gāoxìng | happy; glad | masaya; natutuwa
認識 | rènshì | to get to know (a person) | makilala
也 | yě | also; too | din; rin
呢 | ne | and you? (question particle) | ikaw naman? (pananong)
歲 | suì | years old | taong gulang
我們 | wǒmen | we; us | tayo; kami
你們 | nǐmen | you (plural) | kayo
他們 | tāmen | they; them | sila`,
    dialogue: `A：您好！我叫安娜，我是菲律賓人。 | Nín hǎo! Wǒ jiào Ānnà, wǒ shì Fēilǜbīnrén. | Hello! My name is Anna. I am Filipino. | Magandang araw po! Ako po si Anna, Pilipino po ako.
B：你好！歡迎你來台灣。 | Nǐ hǎo! Huānyíng nǐ lái Táiwān. | Hello! Welcome to Taiwan. | Kumusta! Maligayang pagdating sa Taiwan.
A：謝謝！請問您貴姓？ | Xièxie! Qǐngwèn nín guìxìng? | Thank you! May I ask your surname? | Salamat po! Ano po ang apelyido ninyo?
B：我姓陳。你叫我陳太太。 | Wǒ xìng Chén. Nǐ jiào wǒ Chén tàitai. | My surname is Chen. Call me Mrs. Chen. | Chen ang apelyido ko. Tawagin mo akong Mrs. Chen.
A：陳太太好！很高興認識您。 | Chén tàitai hǎo! Hěn gāoxìng rènshì nín. | Hello, Mrs. Chen! Nice to meet you. | Magandang araw po, Mrs. Chen! Ikinagagalak ko po kayong makilala.
B：我也很高興認識你。這是阿嬤。 | Wǒ yě hěn gāoxìng rènshì nǐ. Zhè shì āmà. | Nice to meet you too. This is Grandma. | Ikinagagalak din kitang makilala. Ito si Lola.
A：阿嬤好！我是您的看護。 | Āmà hǎo! Wǒ shì nín de kānhù. | Hello, Grandma! I am your caregiver. | Magandang araw po, Lola! Ako po ang inyong caregiver.
B：好，好。你幾歲？ | Hǎo, hǎo. Nǐ jǐ suì? | Good, good. How old are you? | Sige, sige. Ilang taon ka na?
A：我三十歲。 | Wǒ sānshí suì. | I am thirty years old. | Tatlumpung taong gulang po ako.`,
  },
  {
    position: 3, hours: 12,
    name: '數字、時間與日期', name_en: 'Numbers, Time & Dates', name_tl: 'Mga Numero, Oras at Petsa',
    category: '基礎', category_en: 'Basics', category_tl: 'Mga Batayan',
    topics: '目標：會說 0 到 10000 的數字和電話號碼；會問時間、星期和日期；會約時間。句型：現在幾點？、今天星期幾？、……是多少？、幾月幾號。發音：「一」數數和唸號碼時唸 yī（一一九 yī yī jiǔ），在量詞前要變調（一個 yí ge、一天 yì tiān）；「十二」要寫隔音符號 shí\'èr；「兩」用在量詞前（兩個人），「二」用在數數和號碼。台灣讀音：「星期」台灣唸 xīngqí，口語也常說「禮拜」lǐbài；「多少」台灣唸 duōshǎo。文化：台灣手機號碼是 09 開頭的十位數；約時間要準時，晚到要先打電話說「不好意思，我會晚一點到」。',
    topics_en: 'Goals: say numbers from 0 to 10,000 and phone numbers, ask the time, the day and the date, and agree on a time. Patterns: 現在幾點？, 今天星期幾？, ……是多少？, 幾月幾號. Pronunciation: 一 is yī when counting or reading numbers (一一九 yī yī jiǔ) but changes before measure words (一個 yí ge, 一天 yì tiān); write the apostrophe in shí\'èr; use 兩 before measure words (兩個人) and 二 for counting and numbers. Taiwan readings: 星期 is xīngqí, and people also say 禮拜 lǐbài; 多少 is duōshǎo. Culture: Taiwan mobile numbers have ten digits and start with 09; be on time, and call ahead if you will be late.',
    topics_tl: 'Layunin: masabi ang mga numero mula 0 hanggang 10,000 at numero ng telepono, magtanong ng oras, araw at petsa, at magkasundo sa oras. Pattern: 現在幾點？, 今天星期幾？, ……是多少？, 幾月幾號. Bigkas: ang 一 ay yī kapag nagbibilang o nagbabasa ng numero (一一九 yī yī jiǔ) pero nagbabago bago ang measure word (一個 yí ge, 一天 yì tiān); isulat ang kudlit sa shí\'èr; gamitin ang 兩 bago ang measure word (兩個人) at ang 二 sa pagbibilang at numero. Bigkas sa Taiwan: ang 星期 ay xīngqí, at sinasabi rin ang 禮拜 lǐbài; ang 多少 ay duōshǎo. Kultura: ang mobile number sa Taiwan ay sampung digit at nagsisimula sa 09; maging nasa oras, at tumawag muna kung mahuhuli.',
    examples: `現在幾點？ | Xiànzài jǐ diǎn? | What time is it now? | Anong oras na?
現在下午三點半。 | Xiànzài xiàwǔ sān diǎn bàn. | It is half past three in the afternoon. | Alas tres y medya na ng hapon.
今天星期五。 | Jīntiān xīngqíwǔ. | Today is Friday. | Biyernes ngayon.
我的電話號碼是零九一二，三四五，六七八。 | Wǒ de diànhuà hàomǎ shì líng jiǔ yī èr, sān sì wǔ, liù qī bā. | My phone number is 0912-345-678. | Ang numero ng telepono ko ay 0912-345-678.
我十月一號來台灣。 | Wǒ shí yuè yī hào lái Táiwān. | I come to Taiwan on October 1st. | Darating ako sa Taiwan sa Oktubre 1.`,
    vocabulary: `零 | líng | zero | sero
一 | yī | one | isa
二 | èr | two | dalawa
三 | sān | three | tatlo
四 | sì | four | apat
五 | wǔ | five | lima
六 | liù | six | anim
七 | qī | seven | pito
八 | bā | eight | walo
九 | jiǔ | nine | siyam
十 | shí | ten | sampu
百 | bǎi | hundred | daan
千 | qiān | thousand | libo
萬 | wàn | ten thousand | sampung libo
兩 | liǎng | two (before measure words) | dalawa (bago ang measure word)
幾 | jǐ | how many (small number) | ilan (maliit na bilang)
多少 | duōshǎo | how many; how much | ilan; magkano
號碼 | hàomǎ | number | numero
電話 | diànhuà | telephone | telepono
點 | diǎn | o'clock | alas (oras)
分 | fēn | minute (on the clock) | minuto (sa orasan)
半 | bàn | half | kalahati; medya
現在 | xiànzài | now | ngayon
時間 | shíjiān | time | oras; panahon
小時 | xiǎoshí | hour | oras (60 minuto)
幾點 | jǐ diǎn | what time | anong oras
今天 | jīntiān | today | ngayong araw
明天 | míngtiān | tomorrow | bukas
昨天 | zuótiān | yesterday | kahapon
每天 | měitiān | every day | araw-araw
星期 | xīngqí | week | linggo (pitong araw)
禮拜 | lǐbài | week (spoken) | linggo (sa usapan)
星期一 | xīngqíyī | Monday | Lunes
星期天 | xīngqítiān | Sunday | Linggo
週末 | zhōumò | weekend | katapusan ng linggo
月 | yuè | month | buwan
號 | hào | day of the month | petsa
年 | nián | year | taon
今年 | jīnnián | this year | ngayong taon
上個月 | shàng ge yuè | last month | noong isang buwan
下個月 | xià ge yuè | next month | sa susunod na buwan
生日 | shēngrì | birthday | kaarawan
早上 | zǎoshàng | early morning | umaga
上午 | shàngwǔ | morning (before noon) | umaga (bago magtanghali)
中午 | zhōngwǔ | noon | tanghali
下午 | xiàwǔ | afternoon | hapon
晚上 | wǎnshàng | evening | gabi
什麼時候 | shénme shíhòu | when | kailan
第 | dì | ordinal prefix (first, second) | pang- (pang-una, pangalawa)`,
    dialogue: `A：請問，現在幾點？ | Qǐngwèn, xiànzài jǐ diǎn? | Excuse me, what time is it now? | Mawalang-galang na po, anong oras na po?
B：現在早上八點十分。 | Xiànzài zǎoshàng bā diǎn shí fēn. | It is ten past eight in the morning. | Alas otso diyes na ng umaga.
A：謝謝。今天星期幾？ | Xièxie. Jīntiān xīngqí jǐ? | Thanks. What day is today? | Salamat. Anong araw ngayon?
B：今天星期六。明天星期天，你休息。 | Jīntiān xīngqíliù. Míngtiān xīngqítiān, nǐ xiūxí. | Today is Saturday. Tomorrow is Sunday, your day off. | Sabado ngayon. Linggo bukas, day off mo.
A：太好了！我想打電話給我媽媽。 | Tài hǎo le! Wǒ xiǎng dǎ diànhuà gěi wǒ māma. | Great! I want to call my mother. | Ang galing! Gusto kong tawagan ang nanay ko.
B：你媽媽的電話號碼是多少？ | Nǐ māma de diànhuà hàomǎ shì duōshǎo? | What is your mother's phone number? | Ano ang numero ng telepono ng nanay mo?
A：是零九一七，二三四，五六七八。 | Shì líng jiǔ yī qī, èr sān sì, wǔ liù qī bā. | It is 0917-234-5678. | 0917-234-5678 po.
B：你幾點打？ | Nǐ jǐ diǎn dǎ? | What time will you call? | Anong oras ka tatawag?
A：晚上七點半。 | Wǎnshàng qī diǎn bàn. | At half past seven in the evening. | Alas siyete y medya ng gabi.`,
  },
  {
    position: 4, hours: 10,
    name: '機場、仲介與證件', name_en: 'Airport, Broker & Documents', name_tl: 'Paliparan, Ahensya at mga Dokumento',
    category: '到台灣生活', category_en: 'Living in Taiwan', category_tl: 'Pamumuhay sa Taiwan',
    topics: '目標：在機場找到仲介；會說自己的證件；證件不見時會求助。句型：這是我的＋證件、我的……不見了、請在這裡簽名、我要找＋人。發音：「護照」hùzhào、「居留證」jūliúzhèng 的 j 後面寫 u 其實唸 ü；「不見了」的「不」在四聲前唸 bú。文化：在台灣，護照和居留證要自己保管，依法雇主和仲介不可以扣留你的證件；簽名以前看不懂可以請翻譯說明，不懂就不要簽；仲介的電話號碼要存在手機裡。',
    topics_en: 'Goals: find your broker at the airport, talk about your documents, and ask for help when a document is lost. Patterns: 這是我的 + document, 我的……不見了, 請在這裡簽名, 我要找 + person. Pronunciation: in jūliúzhèng the u after j is said like ü; 不 in 不見了 is bú before a 4th tone. Culture: in Taiwan you keep your own passport and residence permit (ARC); by law your employer and broker may not hold your documents. Before you sign, ask an interpreter to explain anything you do not understand, and do not sign if you still do not understand. Save your broker\'s phone number in your phone.',
    topics_tl: 'Layunin: mahanap ang ahente sa paliparan, makapagsalita tungkol sa mga dokumento, at humingi ng tulong kapag nawala ang dokumento. Pattern: 這是我的 + dokumento, 我的……不見了, 請在這裡簽名, 我要找 + tao. Bigkas: sa jūliúzhèng ang u pagkatapos ng j ay binibigkas na parang ü; ang 不 sa 不見了 ay bú bago ang ika-4 na tono. Kultura: sa Taiwan, ikaw ang magtatago ng sarili mong pasaporte at ARC; ayon sa batas, hindi puwedeng itago ng amo o ahensya ang iyong mga dokumento. Bago pumirma, magpaliwanag muna sa interpreter kung may hindi naiintindihan, at huwag pumirma kung hindi pa rin malinaw. I-save sa telepono ang numero ng iyong ahente.',
    examples: `這是我的護照。 | Zhè shì wǒ de hùzhào. | This is my passport. | Ito ang aking pasaporte.
我的居留證不見了。 | Wǒ de jūliúzhèng bú jiàn le. | My residence permit is missing. | Nawawala ang ARC ko.
請在這裡簽名。 | Qǐng zài zhèlǐ qiānmíng. | Please sign here. | Pakipirmahan po dito.
我要找我的仲介。 | Wǒ yào zhǎo wǒ de zhòngjiè. | I am looking for my broker. | Hinahanap ko ang aking ahente.
護照要自己保管。 | Hùzhào yào zìjǐ bǎoguǎn. | Keep your passport yourself. | Ikaw dapat ang magtago ng iyong pasaporte.`,
    vocabulary: `機場 | jīchǎng | airport | paliparan
飛機 | fēijī | airplane | eroplano
護照 | hùzhào | passport | pasaporte
居留證 | jūliúzhèng | residence permit (ARC) | ARC; resident permit
簽證 | qiānzhèng | visa | visa
證件 | zhèngjiàn | ID documents | mga dokumento; ID
合約 | héyuē | contract | kontrata
仲介 | zhòngjiè | broker; recruitment agent | ahensya; ahente
公司 | gōngsī | company | kumpanya
翻譯 | fānyì | interpreter; to translate | interpreter; isalin
行李 | xínglǐ | luggage | bagahe
箱子 | xiāngzi | suitcase; box | maleta; kahon
地址 | dìzhǐ | address | address; tirahan
宿舍 | sùshè | dormitory | dormitoryo
照片 | zhàopiàn | photo | litrato
體檢 | tǐjiǎn | health checkup | medical checkup
指紋 | zhǐwén | fingerprint | fingerprint
簽名 | qiānmíng | to sign; signature | pumirma; pirma
填 | tián | to fill in | punan
表格 | biǎogé | form | form
影印 | yǐngyìn | to photocopy | mag-photocopy
等 | děng | to wait | maghintay
排隊 | páiduì | to line up | pumila
帶 | dài | to bring | magdala
給 | gěi | to give | magbigay
拿 | ná | to take; to hold | kunin; hawakan
找 | zhǎo | to look for | hanapin
在 | zài | to be at; at | nasa
這 | zhè | this | ito
那 | nà | that | iyan; iyon
有 | yǒu | to have; there is | mayroon
沒有 | méiyǒu | not have; there is not | wala
的 | de | possessive particle ('s) | ng; ni (pag-aari)
不見了 | bú jiàn le | missing; lost | nawawala
幫忙 | bāngmáng | to help | tumulong
問題 | wèntí | question; problem | tanong; problema
知道 | zhīdào | to know (a fact) | alam
可以 | kěyǐ | can; may | puwede
要 | yào | to want; to need | gusto; kailangan
來 | lái | to come | dumating; pumunta rito
到 | dào | to arrive | dumating
接 | jiē | to pick up (a person) | sunduin
住 | zhù | to live; to stay | tumira
新 | xīn | new | bago
第一次 | dì-yī cì | the first time | unang beses
外國人 | wàiguórén | foreigner | dayuhan
保管 | bǎoguǎn | to keep safe | itago nang maayos
自己 | zìjǐ | oneself | sarili
聯絡 | liánluò | to contact | makipag-ugnayan`,
    dialogue: `A：你好，你是安娜嗎？我是仲介公司的李先生。 | Nǐ hǎo, nǐ shì Ānnà ma? Wǒ shì zhòngjiè gōngsī de Lǐ xiānshēng. | Hello, are you Anna? I am Mr. Li from the broker agency. | Kumusta, ikaw ba si Anna? Ako si Mr. Li ng ahensya.
B：是，我是安娜。李先生好！ | Shì, wǒ shì Ānnà. Lǐ xiānshēng hǎo! | Yes, I am Anna. Hello, Mr. Li! | Opo, ako po si Anna. Magandang araw po, Mr. Li!
A：歡迎來台灣！你的護照呢？ | Huānyíng lái Táiwān! Nǐ de hùzhào ne? | Welcome to Taiwan! Where is your passport? | Maligayang pagdating sa Taiwan! Nasaan ang pasaporte mo?
B：在這裡。 | Zài zhèlǐ. | It is here. | Nandito po.
A：好。我們先去體檢，再去宿舍。 | Hǎo. Wǒmen xiān qù tǐjiǎn, zài qù sùshè. | Okay. First we go for the health checkup, then to the dormitory. | Sige. Magpapa-medical muna tayo, saka pupunta sa dormitoryo.
B：請問，宿舍的地址是什麼？ | Qǐngwèn, sùshè de dìzhǐ shì shénme? | Excuse me, what is the dormitory address? | Mawalang-galang na po, ano po ang address ng dormitoryo?
A：我等一下給你。有問題就打電話給我。 | Wǒ děng yíxià gěi nǐ. Yǒu wèntí jiù dǎ diànhuà gěi wǒ. | I will give it to you in a moment. Call me if you have a problem. | Ibibigay ko mamaya. Kapag may problema, tawagan mo ako.
B：好，謝謝李先生！ | Hǎo, xièxie Lǐ xiānshēng! | Okay, thank you, Mr. Li! | Sige po, salamat po, Mr. Li!`,
  },
  {
    position: 5, hours: 12,
    name: '住宿與垃圾分類', name_en: 'Housing & Sorting Trash', name_tl: 'Tirahan at Paghihiwalay ng Basura',
    category: '到台灣生活', category_en: 'Living in Taiwan', category_tl: 'Pamumuhay sa Taiwan',
    topics: '目標：會說房間和宿舍裡的東西；會報告東西壞了；會照台灣的方式分類垃圾、遵守宿舍規定。句型：……在哪裡？、……壞了、……要＋動作（寶特瓶要資源回收）、不可以＋動作。發音：「垃圾」台灣標準讀音 lèsè，口語也常聽到 lājī，兩種都要聽得懂；「冷氣」lěngqì 的 q 像「ch」但嘴角往兩邊拉。文化：台灣「垃圾不落地」，要在固定時間把垃圾拿給垃圾車，聽到垃圾車的音樂就要出門；一般垃圾、資源回收、廚餘要分開；宿舍晚上要安靜，室內不可以抽菸。',
    topics_en: 'Goals: name things in your room and dormitory, report that something is broken, sort trash the Taiwan way, and follow dorm rules. Patterns: ……在哪裡？, ……壞了, …… + 要 + action (寶特瓶要資源回收), 不可以 + action. Pronunciation: 垃圾 is lèsè in standard Taiwan Mandarin, but you will also hear lājī, so learn both; the q in lěngqì is like "ch" with the lips spread. Culture: in Taiwan trash never sits on the street. You hand it to the garbage truck at fixed times, so go out when you hear its music. Keep general trash, recycling and food scraps apart. Keep quiet at night and do not smoke indoors.',
    topics_tl: 'Layunin: masabi ang mga gamit sa kuwarto at dormitoryo, maireport kapag may sira, maghiwalay ng basura ayon sa paraan sa Taiwan, at sumunod sa mga patakaran ng dorm. Pattern: ……在哪裡？, ……壞了, …… + 要 + gawain (寶特瓶要資源回收), 不可以 + gawain. Bigkas: ang 垃圾 ay lèsè sa pamantayang bigkas sa Taiwan, pero maririnig mo rin ang lājī, kaya alamin ang dalawa; ang q sa lěngqì ay parang "ch" na nakabanat ang labi. Kultura: sa Taiwan, walang basurang iniiwan sa kalsada. Iniaabot ito sa trak ng basura sa takdang oras, kaya lumabas kapag narinig ang musika nito. Paghiwalayin ang karaniwang basura, recyclable at tirang pagkain. Tumahimik sa gabi at bawal manigarilyo sa loob.',
    examples: `垃圾車晚上七點來。 | Lèsèchē wǎnshàng qī diǎn lái. | The garbage truck comes at seven in the evening. | Dumarating ang trak ng basura nang alas siyete ng gabi.
寶特瓶要資源回收。 | Bǎotèpíng yào zīyuán huíshōu. | Plastic bottles go to recycling. | Ang mga plastik na bote ay para sa recycling.
房間的冷氣壞了。 | Fángjiān de lěngqì huài le. | The air conditioner in the room is broken. | Sira ang aircon sa kuwarto.
宿舍裡不可以抽菸。 | Sùshè lǐ bù kěyǐ chōuyān. | No smoking in the dormitory. | Bawal manigarilyo sa loob ng dormitoryo.
請關燈。 | Qǐng guān dēng. | Please turn off the light. | Pakipatay po ang ilaw.`,
    vocabulary: `房間 | fángjiān | room | kuwarto
床 | chuáng | bed | kama
棉被 | miánbèi | blanket; quilt | kumot
枕頭 | zhěntou | pillow | unan
桌子 | zhuōzi | table | mesa
椅子 | yǐzi | chair | silya
衣櫃 | yīguì | wardrobe | aparador
廁所 | cèsuǒ | toilet; restroom | CR; banyo
浴室 | yùshì | bathroom | paliguan
廚房 | chúfáng | kitchen | kusina
冰箱 | bīngxiāng | refrigerator | ref
洗衣機 | xǐyījī | washing machine | washing machine
冷氣 | lěngqì | air conditioner | aircon
電風扇 | diànfēngshàn | electric fan | electric fan; bentilador
燈 | dēng | light; lamp | ilaw
開 | kāi | to turn on; to open | buksan
關 | guān | to turn off; to close | patayin; isara
門 | mén | door | pinto
窗戶 | chuānghù | window | bintana
鑰匙 | yàoshi | key | susi
熱水 | rèshuǐ | hot water | mainit na tubig
插座 | chāzuò | power outlet | saksakan
壞了 | huài le | broken | sira
修 | xiū | to repair | ayusin
室友 | shìyǒu | roommate | kasama sa kuwarto
垃圾 | lèsè | trash | basura
垃圾車 | lèsèchē | garbage truck | trak ng basura
垃圾袋 | lèsèdài | garbage bag | supot ng basura
資源回收 | zīyuán huíshōu | recycling | recycling
廚餘 | chúyú | food scraps | tirang pagkain
寶特瓶 | bǎotèpíng | plastic bottle | plastik na bote
紙類 | zhǐlèi | paper (for recycling) | papel (para i-recycle)
鐵罐 | tiěguàn | tin can | lata
分類 | fēnlèi | to sort | ihiwalay; uriin
丟 | diū | to throw away | itapon
倒垃圾 | dào lèsè | to take out the trash | magtapon ng basura
安靜 | ānjìng | quiet | tahimik
吵 | chǎo | noisy | maingay
乾淨 | gānjìng | clean | malinis
髒 | zāng | dirty | marumi
規定 | guīdìng | rule | patakaran
不可以 | bù kěyǐ | not allowed | bawal
抽菸 | chōuyān | to smoke | manigarilyo
洗澡 | xǐzǎo | to take a bath | maligo
桶子 | tǒngzi | bucket; bin | timba; basurahan`,
    dialogue: `A：安娜，這是你的房間。 | Ānnà, zhè shì nǐ de fángjiān. | Anna, this is your room. | Anna, ito ang kuwarto mo.
B：謝謝！請問，廁所在哪裡？ | Xièxie! Qǐngwèn, cèsuǒ zài nǎlǐ? | Thank you! Excuse me, where is the toilet? | Salamat po! Saan po ang CR?
A：在那裡。洗衣機在外面。 | Zài nàlǐ. Xǐyījī zài wàimiàn. | Over there. The washing machine is outside. | Nandoon. Nasa labas ang washing machine.
B：垃圾要怎麼丟？ | Lèsè yào zěnme diū? | How do I throw away trash? | Paano po magtapon ng basura?
A：要分類。紙類、寶特瓶、鐵罐是資源回收。 | Yào fēnlèi. Zhǐlèi, bǎotèpíng, tiěguàn shì zīyuán huíshōu. | You must sort it. Paper, plastic bottles and cans are recycling. | Kailangang ihiwalay. Ang papel, plastik na bote at lata ay recycling.
B：廚餘呢？ | Chúyú ne? | What about food scraps? | Paano po ang tirang pagkain?
A：廚餘放這個桶子。垃圾車晚上七點來。 | Chúyú fàng zhège tǒngzi. Lèsèchē wǎnshàng qī diǎn lái. | Put food scraps in this bin. The garbage truck comes at seven in the evening. | Ilagay ang tirang pagkain sa basurahang ito. Dumarating ang trak ng basura nang alas siyete ng gabi.
B：好，我知道了。 | Hǎo, wǒ zhīdào le. | Okay, I understand. | Sige po, naintindihan ko na.
A：還有，晚上十點以後要安靜。 | Háiyǒu, wǎnshàng shí diǎn yǐhòu yào ānjìng. | Also, be quiet after ten at night. | At saka, tumahimik pagkalipas ng alas diyes ng gabi.
B：好的，沒問題。 | Hǎo de, méi wèntí. | Sure, no problem. | Opo, walang problema.`,
  },
];
