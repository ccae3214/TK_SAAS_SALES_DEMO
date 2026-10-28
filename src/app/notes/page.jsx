import { redirect } from "next/navigation";
import { auth } from "@/auth";
import NotesWorkspace from "@/components/NotesWorkspace";

export const metadata = {
  title: "我的筆記 | 克雷迅網頁設計",
  description: "跨裝置同步的個人 Markdown 筆記",
};

export default async function NotesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/api/auth/signin?callbackUrl=/notes");
  return <NotesWorkspace email={session.user.email} />;
}
