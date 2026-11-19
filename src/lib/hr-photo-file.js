// 履歷照片選檔前的檢查（管理端與會員端共用）。
// 手機照片常有 3–10 MB，裁切器會縮成 600x750 JPEG，所以這裡只擋超大或不支援的檔案。
// 錯誤訊息的英文版在 hr-translations.jsx，由頁面的語言切換自動翻譯。
export const PHOTO_MAX_BYTES = 30000000;
export const PHOTO_FORMAT_ERROR = '履歷照片請使用 JPG 或 PNG 格式（iPhone 請選擇「最相容」格式，或截圖後上傳）。';
export const PHOTO_SIZE_ERROR = '履歷照片檔案過大，請選擇小於 30 MB 的照片。';

// 回傳錯誤訊息；檔案可用時回傳空字串。
export function photoFileError(file) {
  const isJpegOrPng = /^image\/(jpeg|jpg|pjpeg|png)$/i.test(file.type) || (!file.type && /\.(jpe?g|png)$/i.test(file.name || ''));
  if (!isJpegOrPng) return PHOTO_FORMAT_ERROR;
  if (file.size > PHOTO_MAX_BYTES) return PHOTO_SIZE_ERROR;
  return '';
}
