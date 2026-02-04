import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ExecutiveDashboard } from "@/components/dashboard/ExecutiveDashboard";
import { PricingWorkbench } from "@/components/workbench/PricingWorkbench";
import { AIClustering } from "@/components/clustering/AIClustering";
import { SimulationPanel } from "@/components/simulation/SimulationPanel";

const Index = () => {
  const [currentView, setCurrentView] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  const handleNavigateToWorkbench = () => {
    setCurrentView("workbench");
  };

  return (
    <DashboardLayout
      currentView={currentView}
      onViewChange={setCurrentView}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      {currentView === "dashboard" && (
        <ExecutiveDashboard onNavigateToWorkbench={handleNavigateToWorkbench} />
      )}
      {currentView === "workbench" && (
        <PricingWorkbench searchQuery={searchQuery} />
      )}
      {currentView === "clustering" && <AIClustering />}
      {currentView === "simulation" && <SimulationPanel />}
    </DashboardLayout>
  );
};

export default Index;
