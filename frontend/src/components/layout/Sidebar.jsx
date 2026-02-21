import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";
import {
  Building2,
  LayoutDashboard,
  UploadCloud,
  History,
  FileText,
  Database,
  ShieldAlert,
  Send,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/upload", label: "Upload", icon: UploadCloud },
  { path: "/sessions", label: "Sessions", icon: History },
  { path: "/alerts", label: "Alerts", icon: ShieldAlert },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/submission-simulations", label: "RBI Simulation", icon: Send },
  { path: "/sources", label: "Data Sources", icon: Database },
  { path: "/compliance-store", label: "Rule Store", icon: Building2 }
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const NavItem = ({ item }) => {
    const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
    const Icon = item.icon;

    return (
      <Link
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative",
          isActive ? "bg-sidebar-active text-white" : "text-slate-400 hover:bg-sidebar-hover hover:text-white"
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon className={cn("shrink-0", collapsed ? "w-6 h-6" : "w-5 h-5")} />
        {!collapsed && <span className="text-sm font-medium tracking-wide whitespace-nowrap">{item.label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "bg-sidebar flex flex-col h-screen shrink-0 transition-all duration-300 relative border-r border-slate-800",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <div className="h-16 flex items-center px-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-blue-800 flex items-center justify-center shrink-0 shadow-lg shadow-accent/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-white font-bold tracking-tight text-lg leading-tight">RiskIQ</span>
              <span className="text-accent text-[10px] uppercase font-bold tracking-wider leading-tight">Command Center</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 py-6 px-3 flex flex-col gap-1 overflow-y-auto hide-scrollbar">
        {navItems.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-10 shadow-lg"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className="p-4 border-t border-slate-800 shrink-0">
        <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "px-2")}>
          <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
            <span className="text-xs font-medium text-slate-300">AD</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-slate-200 truncate">Admin User</span>
              <span className="text-xs text-slate-500 truncate">admin@riskiq.local</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
