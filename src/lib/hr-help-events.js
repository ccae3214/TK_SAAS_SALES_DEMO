// 「使用導覽」與「介紹影片」按鈕放在工作起點卡片裡，
// 實際的導覽與影片播放器在別的元件，所以用瀏覽器事件溝通，不用層層傳 props。
export const HR_TOUR_START_EVENT = 'hr-help:start-tour';
export const HR_VIDEO_OPEN_EVENT = 'hr-help:open-video';

// 這些角色的頁面裡有說明按鈕（工作者／雇主／仲介在工作起點，訓練中心在總覽），不再顯示左下角浮動按鈕（浮動按鈕會擋到手機底部選單）。
export const HR_INLINE_HELP_ROLES = ['worker', 'employer', 'agency', 'training_center'];
