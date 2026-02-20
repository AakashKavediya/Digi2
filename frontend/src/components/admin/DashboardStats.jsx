
import { Activity, ShieldCheck, Users, Ban } from "lucide-react";

// Mock implementation of shadcn-like cards using purely tailwind
const StatsCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
            </div>
            <div className={`p-3 rounded-full ${color}`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
        </div>
    </div>
);

const AdminDashboard = () => {
    // Mock Data
    const stats = {
        universities: 12,
        certificates: 1245,
        revoked: 3,
        gas: "12 Gwei"
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard title="Whitelisted Universities" value={stats.universities} icon={Users} color="bg-blue-500" />
            <StatsCard title="Certificates Issued" value={stats.certificates} icon={ShieldCheck} color="bg-green-500" />
            <StatsCard title="Certificates Revoked" value={stats.revoked} icon={Ban} color="bg-red-500" />
            <StatsCard title="Network Gas Fee" value={stats.gas} icon={Activity} color="bg-yellow-500" />
        </div>
    );
};

export default AdminDashboard;
