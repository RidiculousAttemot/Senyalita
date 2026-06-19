import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ConversationTimeline } from "./conversationTimeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ConversationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createSupabaseServerClient();
  
  const { data: session } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("id", params.id)
    .single();
  
  if (!session) notFound();
  
  const { data: messages } = await supabase
    .from("conversation_messages")
    .select("*")
    .eq("session_id", params.id)
    .order("created_at", { ascending: true });
  
  if (!messages) notFound();
  
  return <ConversationTimeline session={session} messages={messages} />;
}
