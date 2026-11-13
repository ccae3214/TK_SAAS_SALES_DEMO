import HrPage from './hr/page';

// 首頁即人力仲介管理系統（與 /hr 相同）；原產品展示首頁已移到 /demo。
// Next.js 要求路由設定必須在本檔直接宣告，不能用 re-export。
export const dynamic = 'force-dynamic';
export const metadata = { title: '克雷迅人力仲介管理系統' };

export default HrPage;
