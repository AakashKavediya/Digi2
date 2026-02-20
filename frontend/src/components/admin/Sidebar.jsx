import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Building2, ScrollText, History, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const Sidebar = ({ isSidebarOpen }) => {
    const { logout } = useAuth();
    const location = useLocation();

    const menuItems = [
        { icon: LayoutDashboard, label: "Overview", path: "/admin" },
        { icon: Building2, label: "University Whitelist", path: "/admin/universities" },
        { icon: LogOut, label: "Revocation Logs", path: "/admin/revocations" },
        { icon: History, label: "System Audit", path: "/admin/audit" },
    ];

    return (
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:inset-auto`}>
            <div className="h-full flex flex-col">
                <div className="flex items-center justify-center h-16 bg-slate-800 border-b border-slate-700">
                    <span className="text-xl font-bold text-white">Admin Panel</span>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                        ? "bg-indigo-600 text-white"
                                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                    }`}
                            >
                                <Icon className="mr-3 h-5 w-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-700">
                    <button
                        onClick={logout}
                        className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-400 rounded-lg hover:bg-slate-800 hover:text-red-300 transition-colors"
                    >
                        <LogOut className="mr-3 h-5 w-5" />
                        Logout
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
