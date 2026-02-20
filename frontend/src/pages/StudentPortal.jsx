import { useState, useEffect, useCallback } from "react";
import { FileText, Shield, Clock, X, CheckCircle, Download, Share2, Scan, GraduationCap, Building, Wallet, UserPlus, Fingerprint, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getContract } from "../utils/web3";
import { verifyCredentials, DEMO_CANDIDATES } from "../utils/credentialsSandbox";

const StudentPortal = ({ wallet, connectWallet }) => {
    const { user } = useAuth();
    const [certificates, setCertificates] = useState([]);
    const [selectedCert, setSelectedCert] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);

    // Registration state
    const [isRegistered, setIsRegistered] = useState(null); // null=checking
    const [aadhaarInput, setAadhaarInput] = useState("");
    const [panInput, setPanInput] = useState("");
    const [nameInput, setNameInput] = useState(user.name || "");
    const [registering, setRegistering] = useState(false);
    const [regError, setRegError] = useState("");
    const [credVerified, setCredVerified] = useState(false);
    const [verifyingCreds, setVerifyingCreds] = useState(false);
    const [showDemoCandidates, setShowDemoCandidates] = useState(false);

    // Check registration status
    useEffect(() => {
        if (!wallet) { setIsRegistered(null); return; }
        const check = async () => {
            try {
                const res = await fetch(`http://localhost:5000/student-status?wallet=${wallet}`);
                const data = await res.json();
                setIsRegistered(data.registered);
            } catch (e) {
                setIsRegistered(false);
            }
        };
        check();
    }, [wallet]);

    // Fetch certificates by wallet
    const fetchCerts = useCallback(async () => {
        if (!wallet || !isRegistered) return;
        try {
            const res = await fetch(`http://localhost:5000/certificates?wallet=${wallet}`);
            const data = await res.json();
            setCertificates(data || []);
        } catch (e) {
            console.error(e);
        }
    }, [wallet, isRegistered]);

    useEffect(() => {
        fetchCerts();
        const iv = setInterval(fetchCerts, 5000);
        return () => clearInterval(iv);
    }, [fetchCerts]);

    // Register with Aadhaar + PAN
    const handleVerifyCredentials = async (e) => {
        e.preventDefault();
        if (aadhaarInput.length !== 12 || panInput.length !== 10) return;
        
        setVerifyingCreds(true);
        setRegError("");
        
        try {
            const res = await fetch("http://localhost:5000/verify-credentials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ aadhaarNumber: aadhaarInput, panNumber: panInput.toUpperCase() })
            });
            
            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }
            
            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }
            
            const data = await res.json();
            
            if (data.verified) {
                setCredVerified(true);
                setNameInput(data.candidate.name);
                setRegError("");
            } else {
                setCredVerified(false);
                setRegError("Credentials not found. Check the demo candidates below.");
            }
        } catch (error) {
            console.error('Credential verification error:', error);
            setCredVerified(false);
            setRegError("Verification failed: " + (error.message || "Unknown error"));
        } finally {
            setVerifyingCreds(false);
        }
    };

    // Register with verified Aadhaar + PAN
    const handleRegister = async (e) => {
        e.preventDefault();
        if (!wallet || !credVerified) return;
        setRegistering(true);
        setRegError("");

        try {
            // 1. Hash Aadhaar & PAN in browser
            const aadhaarBytes = new TextEncoder().encode(aadhaarInput);
            const panBytes = new TextEncoder().encode(panInput.toUpperCase());
            const aadhaarHashBuffer = await crypto.subtle.digest('SHA-256', aadhaarBytes);
            const panHashBuffer = await crypto.subtle.digest('SHA-256', panBytes);
            const aadhaarHash = '0x' + Array.from(new Uint8Array(aadhaarHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            const panHash = '0x' + Array.from(new Uint8Array(panHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

            // 2. Try to register on blockchain (with retry logic)
            let blockchainSuccess = false;
            let blockchainError = null;
            
            try {
                const contract = await getContract(true);
                const tx = await contract.registerStudent(aadhaarHash, nameInput);
                await tx.wait();
                blockchainSuccess = true;
            } catch (bcError) {
                blockchainError = bcError.message || bcError;
                console.warn('Blockchain registration failed, proceeding with backend only:', bcError);
            }

            // 3. Register on backend with both Aadhaar and PAN (required)
            const backendRes = await fetch("http://localhost:5000/register-student", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    aadhaarNumber: aadhaarInput, 
                    panNumber: panInput.toUpperCase(),
                    name: nameInput, 
                    walletAddress: wallet,
                    blockchainTxHash: blockchainSuccess ? "pending" : "failed"
                })
            });
            
            const backendData = await backendRes.json();
            if (!backendRes.ok) {
                throw new Error(backendData.message || "Backend registration failed");
            }

            // 4. Show success (blockchain optional, backend required)
            if (!blockchainSuccess) {
                setRegError(`Backend registration successful! (Blockchain registration skipped - make sure Hardhat is running on http://127.0.0.1:8545)`);
            }
            setIsRegistered(true);
        } catch (error) {
            console.error('Registration error:', 'Registration error:', error);
            let msg = error.message || "Registration failed";
            if (msg.includes("already registered")) msg = "This Aadhaar is already linked to a wallet.";
            if (msg.includes("already linked")) msg = "This wallet is already linked to another Aadhaar.";
            if (msg.includes("RPC endpoint") || msg.includes("127.0.0.1:8545")) msg = "Blockchain connection failed. Make sure Hardhat is running, or your credentials have been saved to backend.";
            setRegError(msg);
        } finally {
            setRegistering(false);
        }
    };

    // ─── No wallet connected ───
    if (!wallet) {
        return (
            <div className="max-w-lg mx-auto p-8 mt-16 text-center">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12">
                    <Wallet size={48} className="mx-auto text-emerald-400 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Connect Student Wallet</h2>
                    <p className="text-sm text-gray-500 mb-6">Connect MetaMask Account #2 to view your credentials.</p>
                    <button onClick={connectWallet} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-3 px-8 rounded-xl hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-200 transition-all">
                        Connect MetaMask
                    </button>
                </div>
            </div>
        );
    }

    // ─── Not registered ───
    if (isRegistered === false) {
        return (
            <div className="max-w-2xl mx-auto p-8 mt-12">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6 text-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Fingerprint size={28} className="mr-3" />
                                <div>
                                    <h2 className="text-xl font-bold">Verify & Link Credentials</h2>
                                    <p className="text-emerald-100 text-sm">Link Aadhaar & PAN to your wallet</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDemoCandidates(!showDemoCandidates)}
                                className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-3 py-1.5 rounded transition-all"
                            >
                                {showDemoCandidates ? "Hide" : "Show"} Demo
                            </button>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        {/* Demo Candidates */}
                        {showDemoCandidates && (
                            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                                <p className="font-semibold text-sm text-blue-900 mb-3">📋 Demo Candidates for Testing (Each has unique wallet ID)</p>
                                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                                    {DEMO_CANDIDATES.map((cand) => (
                                        <div
                                            key={cand.id}
                                            onClick={() => {
                                                setAadhaarInput(cand.aadhaar);
                                                setPanInput(cand.pan);
                                                setNameInput(cand.fullName);
                                            }}
                                            className="bg-white p-3 rounded border border-blue-200 hover:border-blue-400 cursor-pointer hover:shadow-md transition-all text-xs"
                                        >
                                            <p className="font-semibold text-gray-900">{cand.fullName}</p>
                                            <p className="text-gray-600">Aadhaar: {cand.aadhaar}</p>
                                            <p className="text-gray-600">PAN: {cand.pan}</p>
                                            <p className="text-blue-600 font-mono text-xs truncate">Wallet: {cand.walletId}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!credVerified ? (
                            <form onSubmit={handleVerifyCredentials} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" 
                                        value={nameInput} 
                                        onChange={(e) => setNameInput(e.target.value)} 
                                        placeholder="e.g. Rahul Sharma"
                                        disabled
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Aadhaar Number</label>
                                        <input 
                                            type="text" 
                                            required 
                                            maxLength={12} 
                                            className="w-full rounded-lg border border-gray-300 p-3 text-sm font-mono tracking-widest focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" 
                                            value={aadhaarInput} 
                                            onChange={(e) => setAadhaarInput(e.target.value.replace(/\D/g, ''))} 
                                            placeholder="XXXX XXXX XXXX" 
                                        />
                                        <p className="text-xs text-gray-400 mt-1">12 digits (hashed SHA-256)</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">PAN Card Number</label>
                                        <input 
                                            type="text" 
                                            required 
                                            maxLength={10} 
                                            className="w-full rounded-lg border border-gray-300 p-3 text-sm font-mono uppercase focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" 
                                            value={panInput} 
                                            onChange={(e) => setPanInput(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10))} 
                                            placeholder="ABCDE1234F" 
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Format: 5 letters, 4 digits, 1 letter</p>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs text-gray-500">Connected Wallet</p>
                                    <p className="text-sm font-mono text-gray-800 mt-0.5 break-all">{wallet}</p>
                                </div>

                                {regError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{regError}</div>}

                                <button 
                                    type="submit" 
                                    disabled={verifyingCreds || aadhaarInput.length < 12 || panInput.length < 10} 
                                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-3 rounded-xl hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center disabled:opacity-50"
                                >
                                    {verifyingCreds ? <><Loader2 className="animate-spin mr-2 h-5 w-5" /> Verifying...</> : <>Verify Credentials</>}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleRegister} className="space-y-5">
                                <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                                    <div className="flex items-center">
                                        <CheckCircle className="text-green-600 mr-3 flex-shrink-0" size={24} />
                                        <div>
                                            <p className="font-semibold text-green-900">✓ Credentials Verified</p>
                                            <p className="text-sm text-green-700 mt-1">{nameInput} • Aadhaar: {aadhaarInput} • PAN: {panInput}</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border border-gray-300 p-3 text-sm bg-gray-50" 
                                        value={nameInput} 
                                        disabled 
                                    />
                                </div>

                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs text-gray-500">Connected Wallet</p>
                                    <p className="text-sm font-mono text-gray-800 mt-0.5 break-all">{wallet}</p>
                                </div>

                                {regError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{regError}</div>}

                                <div className="flex gap-3">
                                    <button 
                                        type="submit" 
                                        disabled={registering} 
                                        className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-3 rounded-xl hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center disabled:opacity-50"
                                    >
                                        {registering ? <><Loader2 className="animate-spin mr-2 h-5 w-5" /> Registering...</> : <><UserPlus className="mr-2 h-5 w-5" /> Complete Registration</>}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setCredVerified(false)}
                                        className="px-6 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all"
                                    >
                                        Back
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Checking registration... ───
    if (isRegistered === null) {
        return (
            <div className="max-w-lg mx-auto p-8 mt-16 text-center">
                <Loader2 className="animate-spin mx-auto text-emerald-400 h-10 w-10 mb-4" />
                <p className="text-gray-500">Checking registration status...</p>
            </div>
        );
    }

    // ─── Main Credential Wallet ───
    return (
        <div className="flex h-[calc(100vh-4rem)]">
            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-gray-900">My Credential Wallet</h1>
                        <p className="text-sm text-gray-500 mt-1">Certificates issued to your verified identity • {wallet.substring(0, 6)}...{wallet.substring(38)}</p>
                    </div>

                    {/* Update Wallet Section */}
                    <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-gray-900 leading-tight">Update Student Wallet</h3>
                            <p className="text-xs text-gray-500 mt-1">If you need to migrate your identity to a new wallet address.</p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="New Wallet Address (0x...)"
                                className="text-xs font-mono border rounded p-2 w-64 focus:ring-1 focus:ring-emerald-500 outline-none"
                                id="new-wallet-input"
                            />
                            <button
                                onClick={async () => {
                                    const newWallet = document.getElementById('new-wallet-input').value;
                                    if (!/^0x[a-fA-F0-9]{40}$/.test(newWallet)) return alert("Invalid wallet address");
                                    try {
                                        const contract = await getContract(true);
                                        const res = await fetch(`http://localhost:5000/student-status?wallet=${wallet}`);
                                        const data = await res.json();
                                        if (!data.student?.aadhaarHash) return alert("Student data not found");

                                        const tx = await contract.updateStudentWallet(data.student.aadhaarHash, newWallet);
                                        await tx.wait();
                                        alert("Wallet updated on blockchain! Please login with your new wallet.");
                                        window.location.reload();
                                    } catch (e) {
                                        alert("Update failed: " + e.message);
                                    }
                                }}
                                className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded shadow hover:bg-emerald-700 transition-all"
                            >
                                UPDATE
                            </button>
                        </div>
                    </div>

                    {certificates.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center">
                            <GraduationCap size={48} className="mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700">No Certificates Yet</h3>
                            <p className="text-sm text-gray-400 mt-1">When an institution issues a certificate to your wallet, it will appear here automatically.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {certificates.map((cert) => (
                                <div key={cert.id} onClick={() => { setSelectedCert(cert); setShowShareModal(false); }} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-indigo-200 transition-all cursor-pointer group relative overflow-hidden">
                                    <div className="absolute top-3 right-3">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                            <CheckCircle size={10} className="mr-1" /> Verified
                                        </span>
                                    </div>
                                    <div className="p-6">
                                        <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center mb-4">
                                            <GraduationCap size={24} className="text-indigo-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-900 text-lg leading-tight">{cert.course_title || cert.filename}</h3>
                                        <div className="flex items-center mt-2 text-sm text-gray-500">
                                            <Building size={14} className="mr-1.5 text-gray-400" />
                                            Issued by {cert.issuer_name || "Verified Institution"}
                                        </div>
                                        <div className="flex items-center mt-1 text-xs text-gray-400">
                                            <Clock size={12} className="mr-1" />
                                            {new Date(cert.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-between items-center">
                                        <span className="text-xs font-mono text-gray-400 truncate w-32">{cert.cert_hash ? `${cert.cert_hash.substring(0, 10)}...` : ''}</span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedCert(cert); setShowShareModal(true); }} className="text-indigo-500 hover:text-indigo-700 p-1 hover:bg-indigo-50 rounded" title="Share"><Share2 size={16} /></button>
                                            <button className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded" title="Download"><Download size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Blockchain Proof Panel */}
            {selectedCert && !showShareModal && (
                <div className="w-96 bg-white border-l border-gray-200 p-6 overflow-y-auto shadow-xl hidden lg:block">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-900 flex items-center text-lg"><Shield size={20} className="mr-2 text-indigo-600" /> Blockchain Proof</h3>
                        <button onClick={() => setSelectedCert(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"><X size={18} /></button>
                    </div>
                    <div className="space-y-5">
                        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                            <p className="text-sm font-bold text-indigo-900">{selectedCert.course_title}</p>
                            <p className="text-xs text-indigo-600 mt-1">Issued by {selectedCert.issuer_name}</p>
                        </div>
                        <ProofField label="Certificate Hash (SHA-256)" value={selectedCert.cert_hash} mono />
                        {selectedCert.tx_hash && <ProofField label="Transaction Hash" value={selectedCert.tx_hash} mono />}
                        {selectedCert.block_number > 0 && <ProofField label="Block Number" value={`#${selectedCert.block_number}`} />}
                        {selectedCert.issuer_wallet && <ProofField label="Issuer Wallet" value={selectedCert.issuer_wallet} mono />}
                        <ProofField label="Issued On" value={new Date(selectedCert.timestamp).toLocaleString('en-IN')} />
                        <div>
                            <div className="flex items-center text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">
                                <CheckCircle size={18} className="mr-2" />
                                <div>
                                    <span className="font-semibold">Immutable & Verified</span>
                                    <p className="text-xs text-green-600 mt-0.5">This record cannot be altered or deleted.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Share Modal with QR */}
            {showShareModal && selectedCert && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
                        <button onClick={() => setShowShareModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        <div className="text-center mb-6">
                            <div className="mx-auto w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mb-4"><Share2 size={28} className="text-indigo-600" /></div>
                            <h3 className="text-xl font-bold text-gray-900">Share Credential</h3>
                            <p className="text-sm text-gray-500 mt-1">Send this link to recruiters for instant verification</p>
                        </div>
                        <div className="flex flex-col items-center space-y-4 mb-6">
                            <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center border border-gray-200 shadow-inner p-2">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/verify?hash=${selectedCert.cert_hash}`)}`}
                                    alt="Verification QR Code"
                                    className="w-full h-full"
                                />
                            </div>
                            <p className="text-xs text-gray-400 font-mono">Hash: {selectedCert.cert_hash?.substring(0, 24)}...</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg flex items-center justify-between border border-gray-200">
                            <span className="text-xs font-mono text-gray-600 truncate mr-3">
                                {window.location.origin}/verify?hash={selectedCert.cert_hash}
                            </span>
                            <button onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/verify?hash=${selectedCert.cert_hash}`);
                                alert("Verification link copied!");
                            }} className="text-indigo-600 text-xs font-bold hover:underline flex-shrink-0">COPY</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ProofField = ({ label, value, mono = false }) => (
    <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
        <div className={`mt-1.5 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm break-all leading-relaxed ${mono ? 'font-mono text-xs text-gray-600' : 'text-gray-800'}`}>{value}</div>
    </div>
);

export default StudentPortal;
