import { useState } from "react";
import { 
  LayoutDashboard, 
  Table2, 
  Sparkles, 
  FlaskConical, 
  Search,
  Menu,
  Settings,
  Bell,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
  { id: "workbench", label: "Pricing Workbench", icon: Table2 },
  { id: "clustering", label: "AI Clustering", icon: Sparkles },
  { id: "simulation", label: "Simulation", icon: FlaskConical },
];

export function DashboardLayout({
  children,
  currentView,
  onViewChange,
  searchQuery,
  onSearchChange,
}: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
                <Sparkles className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
              <span className="font-semibold text-sidebar-primary-foreground">PriceAI</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-2">
          <button
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
            )}
          >
            <Settings className="h-5 w-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Settings</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search Part Number or Description..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-80 pl-9"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <Badge 
                variant="destructive" 
                className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
              >
                3
              </Badge>
            </Button>
            <div className="flex items-center gap-2 pl-3 border-l">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-xs font-medium text-primary-foreground">JD</span>
              </div>
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">John Doe</span>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
