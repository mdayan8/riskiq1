import { Search, Bell, LogOut, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ApiStatus from "../ApiStatus";

export default function TopNav() {
    const navigate = useNavigate();

    const logout = () => {
        localStorage.removeItem("riskiq_token");
        localStorage.removeItem("riskiq_user");
        navigate("/login");
    };

    return (
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 sticky top-0 z-20 shadow-sm">

            {/* Search Bar - Enterprise Standard */}
            <div className="flex-1 max-w-md relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search projects, sessions, or agents..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium text-gray-500 bg-white border border-gray-200 rounded">⌘</kbd>
                    <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium text-gray-500 bg-white border border-gray-200 rounded">K</kbd>
                </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-5 ml-auto">

                {/* System Status Integration */}
                <div className="hidden sm:flex items-center gap-3 pr-5 border-r border-gray-100">
                    <ApiStatus />
                </div>

                {/* Notifications */}
                <button className="relative p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-900 rounded-full transition-colors">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error border-2 border-white"></span>
                </button>

                {/* Action / Logout */}
                <button
                    onClick={logout}
                    className="flex items-center gap-2 p-2 text-gray-500 hover:text-error hover:bg-error-light/50 rounded-lg transition-colors group"
                    title="Sign out"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="ms:hidden text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 translate-y-8 bg-black text-white px-2 py-1 rounded">Logout</span>
                </button>

            </div>
        </header>
    );
}
