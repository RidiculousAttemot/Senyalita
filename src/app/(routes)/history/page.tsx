import type { UserSessionRow } from "@/features/logging/actions";
import HistoryView from "./history-view";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  return (
    <div className="page">
      <HistoryView authenticated={false} initialSessions={[]} />
    </div>
  );
}
