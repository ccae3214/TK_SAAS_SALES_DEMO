import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminDashboard from "@/components/AdminDashboard";

const getAdminEmails = () =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export default async function Page() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  const adminEmails = getAdminEmails();

  if (!email) {
    redirect("/api/auth/signin?callbackUrl=/admin");
  }

  if (adminEmails.length === 0 || !adminEmails.includes(email)) {
    redirect("/");
  }

  return <AdminDashboard />;
}
