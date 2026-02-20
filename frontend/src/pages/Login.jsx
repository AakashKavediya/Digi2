import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Shield, Lock, Building, GraduationCap, Search, Settings } from "lucide-react";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const res = await fetch("http://localhost:5000/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (data.success) {
                login(data.user);
                navigate(data.user.role === 'admin' ? "/admin" : "/");
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError("Login failed. Check if backend server is running.");
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
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                            <input type="email" required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 text-sm" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                            <input type="password" required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 text-sm" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        </div>

                        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{error}</div>}

                        <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold py-2.5 rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md shadow-indigo-200 flex items-center justify-center">
                            <Lock className="h-4 w-4 mr-2" /> Sign In
                        </button>
                    </form>

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
