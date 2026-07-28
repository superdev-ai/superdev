import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { Offline } from "@/components/shell/states";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError, getOverview } from "@/lib/api";
import { useLive } from "@/lib/live";
import { useRoute, type View } from "@/lib/route";
import { ActivityView } from "@/views/activity";
import { ApisView } from "@/views/apis";
import { ArchitectureView } from "@/views/architecture";
import { ChangesView } from "@/views/changes";
import { DataView } from "@/views/data";
import { DecisionsView } from "@/views/decisions";
import { DiscoveryView } from "@/views/discovery";
import { EvidenceView } from "@/views/evidence";
import { FeaturesView } from "@/views/features";
import { OverviewView } from "@/views/overview";
import { BlueprintView } from "@/views/blueprint";
import { ProductView } from "@/views/product";
import { ReadinessView } from "@/views/readiness";
import { SettingsView } from "@/views/settings";
import { SurfacesView } from "@/views/surfaces";
import { TasksView } from "@/views/tasks";
import { SyncView } from "@/views/sync";
import { TestPlansView } from "@/views/test-plans";
import { TeamView } from "@/views/team";
import { WorkflowsView } from "@/views/workflows";

const VIEW_COMPONENTS: Record<View, () => React.JSX.Element> = {
  overview: OverviewView,
  discovery: DiscoveryView,
  product: ProductView,
  blueprint: BlueprintView,
  features: FeaturesView,
  workflows: WorkflowsView,
  data: DataView,
  architecture: ArchitectureView,
  tasks: TasksView,
  team: TeamView,
  decisions: DecisionsView,
  activity: ActivityView,
  readiness: ReadinessView,
  surfaces: SurfacesView,
  apis: ApisView,
  changes: ChangesView,
  evidence: EvidenceView,
  settings: SettingsView,
  "test-plans": TestPlansView,
  sync: SyncView,
};

export default function App() {
  const { route } = useRoute();
  const { status, revision, reconnect } = useLive();
  const [projectName, setProjectName] = useState<string | undefined | null>(
    undefined,
  );
  const [serviceDown, setServiceDown] = useState(false);

  // The shell needs the project name for its header. It is the one piece of
  // data the frame owns; views fetch everything else for themselves.
  useEffect(() => {
    const controller = new AbortController();
    getOverview(controller.signal)
      .then((result) => {
        setProjectName(result.data.project?.name ?? null);
        setServiceDown(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setProjectName(null);
        setServiceDown(error instanceof ApiError && error.isOffline);
      });
    return () => controller.abort();
  }, [revision]);

  const onReconnect = useCallback(() => {
    setServiceDown(false);
    reconnect();
  }, [reconnect]);

  const ViewComponent = VIEW_COMPONENTS[route.view];

  return (
    <TooltipProvider>
      <AppShell
        view={route.view}
        projectName={projectName}
        connection={status.state}
        connectionExplanation={status.explanation}
        onReconnect={onReconnect}
      >
        {serviceDown && status.state === "offline" ? (
          <div className="p-4 sm:p-6">
            <Offline onReconnect={onReconnect} state="offline" />
          </div>
        ) : (
          <ViewComponent />
        )}
      </AppShell>
    </TooltipProvider>
  );
}
