import crypto from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';

// 自架 SFU（LiveKit）的伺服器端設定與通話憑證。
// 沒設定 LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET 時 sfuConfig 回傳 null，通話維持原本的「每個人彼此直連」(mesh)，
// 人數上限仍是 6 人；設定好之後通話改走 SFU（每個人只上傳一份給伺服器），人數上限提高到 20 人（上限定義在 hr-call-signaling.js）。
// 信令（誰在響鈴、誰加入、麥克風／鏡頭／喇叭狀態）仍由 hr-call-signaling.js 負責，LiveKit 只負責影像與聲音。

const TOKEN_TTL_SECONDS = 300;

export function sfuConfig(env = process.env) {
  const url = String(env.LIVEKIT_URL || '').trim();
  const apiKey = String(env.LIVEKIT_API_KEY || '').trim();
  const apiSecret = String(env.LIVEKIT_API_SECRET || '').trim();
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

// 一個聊天室同時只有一通電話，所以用聊天室編號當 LiveKit 的房間名稱。
export const sfuRoomName = roomId => `hr-call-${Number(roomId)}`;

// 每次加入通話都產生新的識別碼（同一個人開兩個分頁不會互相踢掉）；它會寫進簽章票證，信令伺服器據此對應每個畫面。
export const newSfuIdentity = () => crypto.randomBytes(9).toString('hex');

// 給瀏覽器連 LiveKit 用的限時憑證：只能進這個聊天室的房間，只能發布／訂閱音訊與影像，不能做管理動作。
export async function createSfuToken(config, { identity, name, roomId, ttlSeconds = TOKEN_TTL_SECONDS }) {
  const token = new AccessToken(config.apiKey, config.apiSecret, { identity, name: String(name || '').slice(0, 80), ttl: ttlSeconds });
  token.addGrant({ roomJoin: true, room: sfuRoomName(roomId), canPublish: true, canSubscribe: true, canPublishData: false });
  return token.toJwt();
}
