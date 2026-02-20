import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Shield, Lock, Building, GraduationCap, Search, Settings, Wallet, Loader2, ChevronDown, ChevronUp } from "lucide-react";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [walletLoading, setWalletLoading] = useState(false);
    const [manualWallet, setManualWallet] = useState("");
    const [showManual, setShowManual] = useState(false);
    const [user, setUser] = useState(null); // Local user state for form
    const [aadhaar, setAadhaar] = useState("");
    const [loginTab, setLoginTab] = useState("email"); // email or aadhaar
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            let endpoint = "login";
            let payload = { email, password };

            if (loginTab === "aadhaar") {
                endpoint = "login-aadhaar";
                payload = { aadhaarNumber: aadhaar };
            }

            const res = await fetch(`http://localhost:5000/${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                login(data.user);
                navigate(data.user.role === "admin" ? "/admin" : "/");
            } else {
                setError(data.message || "Login failed");
            }
        } catch (err) {
            setError("Login failed. Check if backend server is running.");
        }
    };

    const handleWalletLogin = async () => {
        setError("");
        let walletAddress = "";

        if (showManual && manualWallet.trim()) {
            walletAddress = manualWallet.trim();
        } else {
            if (!window.ethereum) {
                setError("MetaMask not detected. Please install MetaMask or use manual entry.");
                return;
            }
            setWalletLoading(true);
            try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                walletAddress = accounts[0];
            } catch (err) {
                setWalletLoading(false);
                if (err.code === 4001) setError("MetaMask connection rejected.");
                else setError("Failed to connect MetaMask.");
                return;
            }
        }

        try {
            const res = await fetch("http://localhost:5000/login-wallet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletAddress }),
            });
            const data = await res.json();
            if (data.success) {
                login(data.user);
                navigate("/");
            } else {
                setError(data.message || "Wallet not authorized. Request approval from admin first.");
            }
        } catch (err) {
            setError("Wallet login failed. Make sure your institution is approved by admin.");
        } finally {
            setWalletLoading(false);
        }
    };

    const quickLogin = (email) => {
        setEmail(email);
        setPassword("password");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-indigo-50 to-blue-50 p-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
                        <Shield className="h-9 w-9 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">DigiLocker 2.0</h2>
                    <p className="text-sm text-gray-500 mt-1">Blockchain Academic Credential System</p>
                    <p className="text-xs text-gray-400 mt-0.5">Ministry of Electronics & IT (MeitY)</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                    <div className="flex border-b border-gray-100 mb-6">
                        <button
                            onClick={() => setLoginTab("email")}
                            className={`flex-1 py-3 text-sm font-bold transition-all border-b-2 ${loginTab === "email" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400"}`}
                        >
                            Email Login
                        </button>
                        <button
                            onClick={() => setLoginTab("aadhaar")}
                            className={`flex-1 py-3 text-sm font-bold transition-all border-b-2 ${loginTab === "aadhaar" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400"}`}
                        >
                            Aadhaar Login
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {loginTab === "email" ? (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                                    <input type="email" required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 text-sm" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                                    <input type="password" required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 text-sm" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Aadhaar Number</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={12}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 text-sm font-mono tracking-widest"
                                    placeholder="Enter 12-digit Aadhaar"
                                    value={aadhaar}
                                    onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
                                />
                                <p className="text-[10px] text-gray-400 mt-2">Demo Mode: Any number will be accepted.</p>
                            </div>
                        )}

                        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{error}</div>}

                        <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold py-2.5 rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md shadow-indigo-200 flex items-center justify-center">
                            {loginTab === "email" ? <Lock className="h-4 w-4 mr-2" /> : <GraduationCap className="h-4 w-4 mr-2" />}
                            {loginTab === "email" ? "Sign In" : "Login with Aadhaar"}
                        </button>
                    </form>

                    {/* Wallet Login for Verified Institutions */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        {!showManual ? (
                            <button
                                onClick={handleWalletLogin}
                                disabled={walletLoading}
                                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold py-2.5 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all shadow-md shadow-orange-200 flex items-center justify-center disabled:opacity-50"
                            >
                                {walletLoading ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting Wallet...</>
                                ) : (
                                    <><Wallet className="h-4 w-4 mr-2" /> Login with Wallet (MetaMask)</>
                                )}
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 text-sm font-mono"
                                    placeholder="Paste Wallet Address (0x...)"
                                    value={manualWallet}
                                    onChange={(e) => setManualWallet(e.target.value)}
                                />
                                <button
                                    onClick={handleWalletLogin}
                                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold py-2.5 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all shadow-md shadow-orange-200"
                                >
                                    Login with Manual Address
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => setShowManual(!showManual)}
                            className="w-full text-center text-xs text-orange-600 mt-2 hover:underline flex items-center justify-center"
                        >
                            {showManual ? "Use MetaMask instead" : "Trouble with MetaMask? Enter address manually"}
                        </button>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <p className="text-xs text-center text-gray-400 mb-3 font-medium uppercase tracking-wider">Quick Demo Login — 4 Roles</p>
                        <div className="grid grid-cols-2 gap-3">
                            <QuickBtn onClick={() => quickLogin("admin@demo.com")} icon={<Settings size={14} />} label="Admin (MeitY)" color="slate" />
                            <QuickBtn onClick={() => quickLogin("issuer@demo.com")} icon={<Building size={14} />} label="Institution" color="blue" />
                            <QuickBtn onClick={() => quickLogin("student@demo.com")} icon={<GraduationCap size={14} />} label="Student" color="emerald" />
                            <QuickBtn onClick={() => quickLogin("verifier@demo.com")} icon={<Search size={14} />} label="Verifier" color="amber" />
                        </div>
                        <p className="text-xs text-center text-gray-400 mt-3">Password: <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">password</span></p>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-400">MetaMask Accounts: #0=Admin • #1=Institution • #2=Student • #3=Verifier</p>
                </div>
            </div>
        </div>
    );
};

const QuickBtn = ({ onClick, icon, label, color }) => (
    <button onClick={onClick} className={`flex items-center justify-center gap-2 px-3 py-2.5 bg-${color}-50 hover:bg-${color}-100 border border-${color}-200 rounded-lg text-xs font-medium text-${color}-700 transition-colors`}>
        {icon} {label}
    </button>
);

export default Login;
