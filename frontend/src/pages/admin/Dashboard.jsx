import { useState, useEffect } from "react";
import { Shield, GraduationCap, Building, FileText, Clock, Activity, AlertCircle, CheckCircle, X, Loader2 } from "lucide-react";
import { getContract } from "../../utils/web3";

const Dashboard = () => {
    const [stats, setStats] = useState({ totalCerts: 0, totalStudents: 0, totalUniversities: 0, pendingRequests: 0, recentLogs: [] });
    const [requests, setRequests] = useState([]);
    const [txStatus, setTxStatus] = useState(null);
    const [isAdmin, setIsAdmin] = useState(true); // Default to true to avoid flicker
    const [connectedWallet, setConnectedWallet] = useState(null);

    const checkAdminRole = async () => {
        try {
            const contract = await getContract(false);
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                const wallet = accounts[0];
                setConnectedWallet(wallet);
                const hasRole = await contract.hasRole("0x0000000000000000000000000000000000000000000000000000000000000000", wallet);
                setIsAdmin(hasRole);
            }
        } catch (e) {
            console.error("Error checking admin role:", e);
        }
    };

    useEffect(() => {
        checkAdminRole();
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                checkAdminRole();
            });
        }
    }, []);

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

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const res = await fetch("http://localhost:5000/admin/requests");
                const data = await res.json();
                setRequests((data || []).filter(r => r.status === 'PENDING'));
            } catch (e) {
                console.error(e);
            }
        };
        fetchRequests();
        const iv = setInterval(fetchRequests, 5000);
        return () => clearInterval(iv);
    }, []);

    const handleApprove = async (r) => {
        if (!confirm(`Approve ${r.name}? This will grant ISSUER_ROLE on-chain.`)) return;
        try {
            const contract = await getContract(true);
            const tx = await contract.grantIssuerRole(r.wallet_address);
            await tx.wait();
            await fetch('http://localhost:5000/admin/requests/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: r.id })
            });
            setRequests(prev => prev.filter(req => req.id !== r.id));
            setTxStatus({ type: 'success', msg: `${r.name} approved and ISSUER_ROLE granted on-chain.` });
        } catch (e) {
            console.error(e);
            let errorMsg = e.message;
            if (e.data && e.data.message) errorMsg = e.data.message;
            if (errorMsg.includes("reverted")) {
                errorMsg = "Transaction Reverted: Are you using the correct Admin account (MetaMask Account #0)? Only the deployer can grant roles.";
            }
            setTxStatus({ type: 'error', msg: errorMsg });
        }
    };

    const handleReject = async (r) => {
        if (!confirm(`Reject ${r.name}?`)) return;
        try {
            await fetch('http://localhost:5000/admin/requests/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: r.id })
            });
            setRequests(prev => prev.filter(req => req.id !== r.id));
            setTxStatus({ type: 'success', msg: `${r.name} rejected.` });
        } catch (e) {
            console.error(e);
            setTxStatus({ type: 'error', msg: e.message });
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="text-sm text-slate-500">DigiLocker 2.0 — MeitY Admin Control Panel</p>
            </div>

            {/* Admin Role Warning */}
            {!isAdmin && (
                <div className="mb-6 p-4 rounded-xl flex items-center bg-amber-50 border border-amber-200 text-amber-800 shadow-sm animate-pulse">
                    <Shield size={20} className="mr-3 text-amber-600" />
                    <div>
                        <p className="font-bold">Wrong Admin Account Connected</p>
                        <p className="text-sm">Your connected wallet ({connectedWallet?.substring(0, 10)}...) does not have <b>DEFAULT_ADMIN_ROLE</b>. You cannot approve requests. Please switch to <b>MetaMask Account #0</b>.</p>
                    </div>
                </div>
            )}

            {/* TX Status */}
            {txStatus && (
                <div className={`mb-6 p-4 rounded-xl flex items-start justify-between ${txStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                    <p className="text-sm">{txStatus.msg}</p>
                    <button onClick={() => setTxStatus(null)} className="ml-3 text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Certificates Issued" value={stats.totalCerts} icon={<FileText className="text-indigo-500" />} color="indigo" />
                <StatCard title="Registered Students" value={stats.totalStudents} icon={<GraduationCap className="text-emerald-500" />} color="emerald" />
                <StatCard title="Whitelisted Institutions" value={stats.totalUniversities} icon={<Building className="text-blue-500" />} color="blue" />
                <StatCard title="Pending Requests" value={stats.pendingRequests} icon={<AlertCircle className="text-amber-500" />} color="amber" highlight={stats.pendingRequests > 0} />
            </div>

            {/* Pending Institution Requests */}
            {requests.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden mb-8">
                    <div className="px-6 py-4 border-b border-amber-100 bg-amber-50 flex items-center">
                        <AlertCircle size={18} className="mr-2 text-amber-600" />
                        <h3 className="font-bold text-amber-900">Pending Institution Requests ({requests.length})</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {requests.map((r) => (
                            <div key={r.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                                <div>
                                    <div className="text-sm font-semibold text-slate-800">{r.name}</div>
                                    <div className="text-xs font-mono text-slate-500 mt-1">{r.wallet_address}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">Submitted: {new Date(r.submitted_at).toLocaleString('en-IN')}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleApprove(r)}
                                        disabled={isAdmin !== true}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${isAdmin === true ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-50'}`}
                                    >
                                        <CheckCircle size={14} className="mr-1.5" /> Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(r)}
                                        disabled={isAdmin !== true}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${isAdmin === true ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200' : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'}`}
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                                    <span className={`w-2 h-2 rounded-full mr-3 ${log.action.includes('CERT') ? 'bg-green-500' : log.action.includes('WHITELIST') ? 'bg-blue-500' : log.action.includes('REGISTER') ? 'bg-emerald-500' : log.action.includes('REVOKE') ? 'bg-red-500' : log.action.includes('INSTITUTION') ? 'bg-amber-500' : 'bg-gray-400'}`} />
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

const StatCard = ({ title, value, icon, color, highlight = false }) => (
    <div className={`bg-white rounded-xl shadow-sm border ${highlight ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'} p-6 flex items-center hover:shadow-md transition-shadow`}>
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-${color}-50 mr-4`}>{icon}</div>
        <div>
            <p className={`text-3xl font-bold ${highlight ? 'text-amber-600' : 'text-slate-900'}`}>{value}</p>
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
