import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import StudentPortal from "./pages/StudentPortal";
import VerifierPortal from "./pages/VerifierPortal";
import IssuerPortal from "./pages/IssuerPortal";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import UniversityWhitelist from "./pages/admin/UniversityWhitelist";
import RevocationLogs from "./pages/admin/RevocationLogs";
import SystemAudit from "./pages/admin/SystemAudit";
import PublicVerify from "./pages/PublicVerify";
import Login from "./pages/Login";
import { Shield, LogOut, Wallet, Building, GraduationCap, Search, Settings } from "lucide-react";

function App() {
    const { user, logout } = useAuth();
    const [wallet, setWallet] = useState(null);

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.request({ method: 'eth_accounts' })
                .then(accounts => {
                    if (accounts.length > 0) setWallet(accounts[0]);
                });
            window.ethereum.on('accountsChanged', (accounts) => {
                setWallet(accounts.length > 0 ? accounts[0] : null);
            });
        }
    }, []);

    const connectWallet = async () => {
        if (!window.ethereum) return;
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            setWallet(accounts[0]);
        } catch (error) {
            console.warn("Wallet connection failed", error);
            // Silently fail, UI already shows fallback session status
            setWallet(null);
        }
    };

    // Public /verify route — accessible without login
    const location = useLocation();
    if (location.pathname === '/verify') {
        return (
            <Routes>
                <Route path="/verify" element={<PublicVerify />} />
            </Routes>
        );
    }

    if (!user) return <Login />;

    // Admin gets dedicated sidebar layout
    if (user.role === 'admin') {
        return (
            <Routes>
                <Route path="/admin" element={<AdminLayout wallet={wallet} connectWallet={connectWallet} />}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="universities" element={<UniversityWhitelist />} />
                    <Route path="revocations" element={<RevocationLogs />} />
                    <Route path="audit" element={<SystemAudit />} />
                </Route>
                <Route path="*" element={<Navigate to="/admin" />} />
            </Routes>
        );
    }

    // Determine effective wallet (MetaMask or Session)
    const effectiveWallet = wallet || user?.walletAddress;

    // Header config
    const roleConfig = {
        student: { label: "Student Wallet", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <GraduationCap size={14} /> },
        verifier: { label: "Verifier Portal", color: "bg-amber-50 text-amber-700 border-amber-200", icon: <Search size={14} /> },
        institution: { label: "Institution Portal", color: "bg-blue-50 text-blue-700 border-blue-200", icon: <Building size={14} /> },
    };
    const config = roleConfig[user.role] || { label: user.role, color: "bg-gray-100 text-gray-700", icon: <Settings size={14} /> };

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Shield className="h-7 w-7 text-indigo-600" />
                            <span className="ml-2 text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">
                                DigiLocker 2.0
                            </span>
                            <span className="hidden sm:block ml-2 text-xs text-gray-400">Ministry of Electronics & IT</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${config.color}`}>
                                {config.icon} {config.label}
                            </span>

                            {effectiveWallet ? (
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${wallet ? 'bg-indigo-50 border-indigo-100' : 'bg-orange-50 border-orange-100 animate-pulse'}`}>
                                    <div className={`w-2 h-2 rounded-full ${wallet ? 'bg-green-500' : 'bg-orange-500'}`} />
                                    <span className={`text-xs font-mono ${wallet ? 'text-indigo-700' : 'text-orange-700'}`}>
                                        {effectiveWallet.substring(0, 6)}...{effectiveWallet.substring(38)}
                                        {!wallet && <span className="ml-2 opacity-60">(Session)</span>}
                                    </span>
                                </div>
                            ) : (
                                <button onClick={connectWallet} className="flex items-center gap-2 bg-orange-50 hover:bg-orange-100 text-orange-700 px-4 py-2 rounded-lg text-xs font-semibold transition-colors border border-orange-200">
                                    <Wallet size={14} /> Connect Wallet
                                </button>
                            )}

                            <span className="hidden md:block text-sm text-gray-600 font-medium">{user.name}</span>
                            <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 transition-colors" title="Logout">
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Role-Based Portals */}
            {user.role === 'student' && <StudentPortal wallet={effectiveWallet} connectWallet={connectWallet} />}
            {user.role === 'verifier' && <VerifierPortal />}
            {user.role === 'institution' && <IssuerPortal wallet={effectiveWallet} connectWallet={connectWallet} connectedMetaMask={wallet} />}
        </div>
    );
}

export default App;
