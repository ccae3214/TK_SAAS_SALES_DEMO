// 整理推播（VAPID）金鑰。.env 裡的金鑰常被夾帶引號、空白、換行、標籤文字（例如「Public Key:」）或結尾的「=」，
// 瀏覽器的 atob 與 web-push 遇到這些字元都會報錯（InvalidCharacterError），開關就卡住無法切換。
// 這裡從字串裡找出「長度剛好」的金鑰，並轉成 URL-safe base64（沒有 =）。只做字串運算，伺服器與瀏覽器都能用。
const NOT_KEY_CHARS = /[^A-Za-z0-9_+\/-]+/;

export function normalizeVapidKey(raw, { length, prefix = '' } = {}) {
  const hit = String(raw ?? '').split(NOT_KEY_CHARS).find(token => token.length === length && token.startsWith(prefix));
  return hit ? hit.replace(/\+/g, '-').replace(/\//g, '_') : '';
}

// 公開金鑰是 65 位元組（未壓縮的 P-256 點，開頭固定是 B），私密金鑰是 32 位元組。
export const normalizeVapidPublicKey = raw => normalizeVapidKey(raw, { length: 87, prefix: 'B' });
export const normalizeVapidPrivateKey = raw => normalizeVapidKey(raw, { length: 43 });
