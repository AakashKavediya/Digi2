import { useState, useEffect } from "react";
import { Shield, GraduationCap, Building, FileText, Clock, Activity } from "lucide-react";

const Dashboard = () => {
    const [stats, setStats] = useState({ totalCerts: 0, totalStudents: 0, totalUniversities: 0, recentLogs: [] });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch("http://localhost:5000/admin/stats");
                const data = await res.json();
                setStats(data);
            } catch (e) {
                console.error(e);
            }
        };
        fetchStats();
        const iv = setInterval(fetchStats, 5000);
        return () => clearInterval(iv);
    }, []);

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="text-sm text-slate-500">DigiLocker 2.0 — MeitY Admin Control Panel</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                <StatCard title="Certificates Issued" value={stats.totalCerts} icon={<FileText className="text-indigo-500" />} color="indigo" />
                <StatCard title="Registered Students" value={stats.totalStudents} icon={<GraduationCap className="text-emerald-500" />} color="emerald" />
                <StatCard title="Whitelisted Institutions" value={stats.totalUniversities} icon={<Building className="text-blue-500" />} color="blue" />
            </div>

            {/* Blockchain Info */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                <h3 className="font-bold text-slate-900 flex items-center mb-4"><Shield size={18} className="mr-2 text-indigo-500" /> Blockchain RBAC</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <RoleCard role="Admin (MeitY)" account="#0" desc="Grant/Revoke ISSUER_ROLE" color="slate" />
                    <RoleCard role="Institution" account="#1" desc="Issue certificates" color="blue" />
                    <RoleCard role="Student" account="#2" desc="View credentials" color="emerald" />
                    <RoleCard role="Verifier" account="#3" desc="Verify authenticity" color="amber" />
                </div>
            </div>

            {/* Audit Log */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center">
                    <Activity size={18} className="mr-2 text-indigo-500" />
                    <h3 className="font-bold text-slate-900">Recent Activity</h3>
                </div>
                <div className="divide-y divide-slate-100">
                    {stats.recentLogs.length === 0 ? (
                        <div className="px-6 py-8 text-center text-slate-400 text-sm">No activity yet.</div>
                    ) : (
                        stats.recentLogs.map((log) => (
                            <div key={log.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                                <div className="flex items-center">
                                    <span className={`w-2 h-2 rounded-full mr-3 ${log.action.includes('CERT') ? 'bg-green-500' : log.action.includes('WHITELIST') ? 'bg-blue-500' : log.action.includes('REGISTER') ? 'bg-emerald-500' : log.action.includes('REVOKE') ? 'bg-red-500' : 'bg-gray-400'}`} />
                                    <div>
                                        <span className="text-sm font-medium text-slate-800">{log.action}</span>
                                        <p className="text-xs text-slate-500">{log.details}</p>
                                    </div>
                                </div>
                                <div className="text-right text-xs text-slate-400 flex items-center">
                                    <Clock size={12} className="mr-1" />
                                    {new Date(log.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, color }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center hover:shadow-md transition-shadow`}>
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-${color}-50 mr-4`}>{icon}</div>
        <div>
            <p className="text-3xl font-bold text-slate-900">{value}</p>
            <p className="text-sm text-slate-500">{title}</p>
        </div>
    </div>
);

const RoleCard = ({ role, account, desc, color }) => (
    <div className={`p-4 rounded-lg bg-${color}-50 border border-${color}-200`}>
        <p className="text-sm font-bold text-slate-800">{role}</p>
        <p className="text-xs text-gray-500 mt-0.5">MetaMask {account}</p>
        <p className="text-xs text-gray-400 mt-1">{desc}</p>
    </div>
);

export default Dashboard;
