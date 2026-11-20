import { Conversation } from "@/components/Conversation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  return <Conversation user={user} />;
}
