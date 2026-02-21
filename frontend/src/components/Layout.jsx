import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import ApiStatus from "./ApiStatus";

const navItems = [
  ["/", "Dashboard"],
  ["/upload", "Upload"],
  ["/sessions", "Sessions"],
  ["/compliance-store", "Rule Store"],
  ["/alerts", "Alerts"],
  ["/reports", "Reports"],
  ["/sources", "Sources"]
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("riskiq_user") || "{}");

  const logout = () => {
    localStorage.removeItem("riskiq_token");
    localStorage.removeItem("riskiq_user");
    navigate("/login");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div>
            <h1 className="text-xl font-semibold text-blue-800">RiskIQ Command Center</h1>
            <p className="text-xs text-slate-500">Autonomous compliance and decision intelligence</p>
          </div>
          <ApiStatus />
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{user.email || "No user"}</span>
            <button onClick={logout} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white">Logout</button>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 pb-3">
          {navItems.map(([path, label]) => (
            <Link
              key={path}
              to={path}
              className={`rounded-full px-3 py-1.5 text-sm ${
                location.pathname === path ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
