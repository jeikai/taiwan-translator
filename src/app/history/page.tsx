import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { HistoryList } from "@/components/HistoryList";

export const metadata = { title: "Lịch sử · Phiên dịch tiếng Đài" };

export default async function HistoryPage() {
  if (!(await getCurrentUser())) redirect("/login");
  return <HistoryList />;
}
