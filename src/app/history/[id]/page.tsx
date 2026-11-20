import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { HistoryDetail } from "@/components/HistoryDetail";

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) redirect("/login");
  const { id } = await params;
  return <HistoryDetail id={id} />;
}
