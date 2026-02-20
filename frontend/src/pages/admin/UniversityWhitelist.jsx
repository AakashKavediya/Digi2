import { useState, useEffect } from "react";
import { Plus, Trash2, ShieldCheck, ShieldAlert, Loader2, ExternalLink, AlertTriangle, CheckCircle, X, Wallet } from "lucide-react";
import { getContract } from "../../utils/web3";
import { ethers } from "ethers";

const UniversityWhitelist = () => {
    const [universities, setUniversities] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: "", website: "", wallet_address: "" });
    const [loading, setLoading] = useState(false);
    const [isAdmin, setIsAdmin] = useState(null); // null = checking
    const [connectedWallet, setConnectedWallet] = useState(null);
    const [txStatus, setTxStatus] = useState(null); // { type: 'success'|'error', msg }

    useEffect(() => {
        fetchUniversities();
        checkAdminStatus();
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
            if (msg.includes("AccessControl")) msg = "Your wallet does NOT have ADMIN_ROLE. Switch MetaMask to Account #0 (deployer).";
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
                    <button
                        onClick={() => setIsModalOpen(true)}
                        disabled={!isAdmin}
                        className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus size={18} className="mr-2" /> Add Institution
                    </button>
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
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Institution Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Wallet Address</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date Added</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {universities.map((uni) => (
                            <tr key={uni.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-slate-900">{uni.name}</div>
                                    <div className="text-sm text-slate-500 flex items-center mt-1">
                                        <ExternalLink size={12} className="mr-1" />
                                        {uni.website}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded">{uni.wallet_address}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {uni.status === 'VERIFIED' ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            <ShieldCheck size={12} className="mr-1" /> Verified
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                            <ShieldAlert size={12} className="mr-1" /> Revoked
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {new Date(uni.added_on).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    {uni.status === 'VERIFIED' && (
                                        <button
                                            onClick={() => handleRevoke(uni)}
                                            disabled={!isAdmin}
                                            className="text-red-500 hover:text-red-700 font-medium text-sm border border-red-200 hover:bg-red-50 px-3 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Revoke
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {universities.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                                    No institutions whitelisted yet. Add one to grant ISSUER_ROLE.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
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
