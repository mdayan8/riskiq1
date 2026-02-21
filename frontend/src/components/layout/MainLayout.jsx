import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

export default function MainLayout() {
    return (
        <div className="flex h-screen bg-background text-gray-900 font-sans overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col h-full min-w-0">
                <TopNav />

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto px-6 py-8 md:px-8">
                    <div className="mx-auto max-w-7xl h-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
