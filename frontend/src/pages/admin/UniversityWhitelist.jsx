import { useState, useEffect } from "react";
import { Plus, Trash2, ShieldCheck, ShieldAlert, Loader2, ExternalLink, AlertTriangle, CheckCircle, X, Wallet } from "lucide-react";
import { getContract } from "../../utils/web3";
import { ethers } from "ethers";

const UniversityWhitelist = () => {
    const [universities, setUniversities] = useState([]);
    const [requests, setRequests] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: "", website: "", wallet_address: "" });
    const [loading, setLoading] = useState(false);
    const [isAdmin, setIsAdmin] = useState(null); // null = checking
    const [connectedWallet, setConnectedWallet] = useState(null);
    const [txStatus, setTxStatus] = useState(null); // { type: 'success'|'error', msg }

    useEffect(() => {
        fetchUniversities();
        fetchRequests();
        checkAdminStatus();

        if (window.ethereum) {
            const handleAccounts = () => checkAdminStatus();
            window.ethereum.on('accountsChanged', handleAccounts);
            return () => window.ethereum.removeListener('accountsChanged', handleAccounts);
        }
    }, []);

    const fetchUniversities = async () => {
        try {
            const res = await fetch("http://localhost:5000/admin/universities");
            const data = await res.json();
            setUniversities(data);
        } catch (error) {
            console.error("Failed to fetch universities", error);
        }
    };

    const fetchRequests = async () => {
        try {
            const res = await fetch('http://localhost:5000/admin/requests');
            const data = await res.json();
            setRequests(data || []);
        } catch (e) {
            console.error('Failed to fetch requests', e);
        }
    };

    const checkAdminStatus = async () => {
        if (!window.ethereum) { setIsAdmin(false); return; }
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length === 0) { setIsAdmin(false); return; }
            setConnectedWallet(accounts[0]);

            const contract = await getContract(false);
            const result = await contract.isAdmin(accounts[0]);
            setIsAdmin(result);
        } catch (e) {
            console.error(e);
            setIsAdmin(false);
        }
    };

    const connectWallet = async () => {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            setConnectedWallet(accounts[0]);
            checkAdminStatus();
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddUniversity = async (e) => {
        e.preventDefault();
        setLoading(true);
        setTxStatus(null);

        try {
            // 1. Call smart contract to grant ISSUER_ROLE
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = await getContract(true);

            console.log("Granting ISSUER_ROLE to:", formData.wallet_address);
            const tx = await contract.grantIssuerRole(formData.wallet_address);
            await tx.wait();

            // 2. Save to backend DB
            const res = await fetch("http://localhost:5000/admin/universities", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                fetchUniversities();
                setIsModalOpen(false);
                setFormData({ name: "", website: "", wallet_address: "" });
                setTxStatus({ type: 'success', msg: `✅ ${formData.name} whitelisted! ISSUER_ROLE granted on-chain.` });
            }
        } catch (error) {
            console.error(error);
            let msg = error.message || "Transaction failed";
            if (error.data && error.data.message) msg = error.data.message;
            if (msg.includes("reverted")) {
                msg = "Transaction Reverted: Your wallet does NOT have ADMIN_ROLE. Switch MetaMask to Account #0 (deployer).";
            }
            setTxStatus({ type: 'error', msg });
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (uni) => {
        if (!confirm(`Revoke ISSUER_ROLE for ${uni.name}?`)) return;
        try {
            const contract = await getContract(true);
            const tx = await contract.revokeIssuerRole(uni.wallet_address);
            await tx.wait();

            await fetch("http://localhost:5000/admin/universities/revoke", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: uni.id })
            });
            fetchUniversities();
            setTxStatus({ type: 'success', msg: `${uni.name} ISSUER_ROLE revoked.` });
        } catch (error) {
            console.error(error);
            setTxStatus({ type: 'error', msg: error.message });
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Institution Whitelist</h1>
                    <p className="text-sm text-slate-500">Grant ISSUER_ROLE on-chain to authorize institutions.</p>
                </div>
                <div className="flex items-center gap-3">
                    {isAdmin === false && !connectedWallet && (
                        <button onClick={connectWallet} className="flex items-center bg-orange-50 text-orange-700 border border-orange-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors">
                            <Wallet size={16} className="mr-2" /> Connect Admin Wallet
                        </button>
                    )}
                    <div className="text-sm text-slate-500">Approve or reject incoming institution requests below.</div>
                </div>
            </div>

            {/* Admin Role Warning */}
            {isAdmin === false && connectedWallet && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start">
                    <AlertTriangle size={20} className="text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800">
                        <p className="font-semibold">Your wallet does not have ADMIN_ROLE</p>
                        <p className="text-xs mt-1">Switch MetaMask to <strong>Account #0</strong> (the deployer address) to manage institutions.</p>
                        <p className="text-xs text-red-600 font-mono mt-1">Connected: {connectedWallet}</p>
                    </div>
                </div>
            )}

            {isAdmin && connectedWallet && (
                <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center text-sm text-green-800">
                    <CheckCircle size={18} className="mr-2 text-green-600" />
                    <span className="font-medium">ADMIN_ROLE verified on-chain.</span>
                    <span className="ml-2 font-mono text-xs text-green-600">{connectedWallet.substring(0, 10)}...{connectedWallet.substring(38)}</span>
                </div>
            )}

            {/* TX Status */}
            {txStatus && (
                <div className={`mb-6 p-4 rounded-xl flex items-start justify-between ${txStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                    <p className="text-sm">{txStatus.msg}</p>
                    <button onClick={() => setTxStatus(null)} className="ml-3 text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
            )}

            {/* Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold mb-3">Pending Institution Requests</h3>
                    <div className="space-y-3">
                        {requests.filter(r => r.status === 'PENDING').map((r) => (
                            <div key={r.id} className="p-3 border rounded-lg flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium">{r.name}</div>
                                    <div className="text-xs font-mono text-slate-500 mt-1">{r.wallet_address}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={async () => {
                                        if (!confirm(`Approve ${r.name}? This will grant ISSUER_ROLE on-chain.`)) return;
                                        try {
                                            const contract = await getContract(true);
                                            const tx = await contract.grantIssuerRole(r.wallet_address);
                                            await tx.wait();
                                            await fetch('http://localhost:5000/admin/requests/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) });
                                            fetchUniversities(); fetchRequests();
                                            setTxStatus({ type: 'success', msg: `${r.name} approved and role granted.` });
                                        } catch (e) {
                                            console.error(e);
                                            let errorMsg = e.message;
                                            if (e.data && e.data.message) errorMsg = e.data.message;
                                            if (errorMsg.includes("reverted")) {
                                                errorMsg = "Transaction Reverted: Only the Admin (Account #0) can grant roles.";
                                            }
                                            setTxStatus({ type: 'error', msg: errorMsg });
                                        }
                                    }}
                                        disabled={isAdmin !== true}
                                        className={`px-3 py-1 rounded text-sm transition-opacity ${isAdmin === true ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'}`}
                                    >Approve</button>
                                    <button onClick={async () => {
                                        if (!confirm(`Reject ${r.name}?`)) return;
                                        await fetch('http://localhost:5000/admin/requests/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) });
                                        fetchRequests();
                                    }}
                                        disabled={isAdmin !== true}
                                        className={`px-3 py-1 rounded text-sm border transition-opacity ${isAdmin === true ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'}`}
                                    >Reject</button>
                                </div>
                            </div>
                        ))}
                        {requests.filter(r => r.status === 'PENDING').length === 0 && (
                            <div className="text-xs text-slate-500">No pending requests.</div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold mb-3">Whitelisted Institutions</h3>
                    <div className="space-y-3">
                        {universities.map((uni) => (
                            <div key={uni.id} className="p-3 border rounded-lg flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium">{uni.name}</div>
                                    <div className="text-xs font-mono text-slate-500 mt-1">{uni.wallet_address}</div>
                                </div>
                                <div>
                                    {uni.status === 'VERIFIED' ? (<span className="text-xs text-green-700">Verified</span>) : (<span className="text-xs text-red-700">Revoked</span>)}
                                </div>
                            </div>
                        ))}
                        {universities.length === 0 && (
                            <div className="text-xs text-slate-500">No institutions whitelisted yet.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Institution Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900">Whitelist Institution</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-500"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddUniversity} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Institution Name</label>
                                <input type="text" required className="mt-1 block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. IIT Bombay" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Website</label>
                                <input type="url" required className="mt-1 block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500" placeholder="https://" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Wallet Address (0x...)</label>
                                <input type="text" required pattern="^0x[a-fA-F0-9]{40}$" className="mt-1 block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500 font-mono" placeholder="0x..." value={formData.wallet_address} onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })} />
                                <p className="mt-1 text-xs text-gray-400">This address will receive ISSUER_ROLE on-chain</p>
                            </div>
                            <button type="submit" disabled={loading} className="w-full flex justify-center items-center py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
                                {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Granting on Blockchain...</> : "Grant ISSUER_ROLE & Whitelist"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UniversityWhitelist;
