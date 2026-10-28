import { Suspense } from "react";
import AgentsPageScreen from "@/features/agents/screens/AgentsPageScreen";
import { AgentStoreProvider } from "@/features/agents/state/store";
import { TeamStoreProvider } from "@/features/teams/store";

export default function AgentsPage() {
  return (
    <AgentStoreProvider>
      <TeamStoreProvider>
        <Suspense fallback={null}>
          <AgentsPageScreen />
        </Suspense>
      </TeamStoreProvider>
    </AgentStoreProvider>
  );
}
