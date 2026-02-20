import { useState, useEffect } from "react";
import { Upload, FileText, Loader2, CheckCircle, Shield, Hash, CreditCard, AlertTriangle, Search, UserCheck, Building, Wallet } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getContract } from "../utils/web3";
import { ethers } from "ethers";

const IssuerPortal = ({ wallet, connectWallet, connectedMetaMask }) => {
    const { user } = useAuth();
    const [file, setFile] = useState(null);
    const [aadhaarNumber, setAadhaarNumber] = useState("");
    const [courseTitle, setCourseTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [hasIssuerRole, setHasIssuerRole] = useState(null); // null = checking, true/false = result
    const [studentLookup, setStudentLookup] = useState(null); // { found, name, wallet, aadhaarHash }
    const [lookingUp, setLookingUp] = useState(false);
    const [manualInstWallet, setManualInstWallet] = useState(wallet || ""); // For manual entry in registration

    // Check if connected wallet has ISSUER_ROLE
    useEffect(() => {
        let isMounted = true;
        const checkRole = async () => {
            if (!wallet) { setHasIssuerRole(null); return; }
            try {
                const contract = await getContract(false);
                const result = await contract.isIssuer(wallet);
                if (isMounted) setHasIssuerRole(result);
            } catch (e) {
                console.error("Role check failed:", e);
                if (isMounted) setHasIssuerRole(false);
            }
        };
        checkRole();
        return () => { isMounted = false; };
    }, [wallet]);

    // Check registration / request status from backend
    const [instName, setInstName] = useState("");
    const [requestStatus, setRequestStatus] = useState(null); // PENDING / APPROVED / REJECTED / NOT_FOUND

    useEffect(() => {
        const fetchStatus = async () => {
            if (!wallet) { setRequestStatus(null); return; }
            try {
                const res = await fetch(`http://localhost:5000/institutions/status?wallet=${wallet}`);
                const data = await res.json();
                if (data.status) setRequestStatus(data.status);
            } catch (e) {
                setRequestStatus(null);
            }
        };
        fetchStatus();
        const iv = setInterval(fetchStatus, 5000);
        return () => clearInterval(iv);
    }, [wallet]);

    // Lookup student by Aadhaar
    const lookupStudent = async () => {
        if (aadhaarNumber.length < 12) return;
        setLookingUp(true);
        setStudentLookup(null);
        try {
            const res = await fetch("http://localhost:5000/lookup-student", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ aadhaarNumber })
            });
            const data = await res.json();
            setStudentLookup(data);
        } catch (e) {
            setStudentLookup({ found: false });
        } finally {
            setLookingUp(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
    };

    const handleIssue = async (e) => {
        e.preventDefault();
        if (!file || !studentLookup?.found || !wallet) return;
        setLoading(true);
        setResult(null);

        try {
            // Step 1: SHA-256 hash of file
            const buffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const hashHex = '0x' + Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

            // Step 2: Aadhaar hash
            const aadhaarBytes = new TextEncoder().encode(aadhaarNumber);
            const aadhaarHashBuffer = await crypto.subtle.digest('SHA-256', aadhaarBytes);
            const aadhaarHash = '0x' + Array.from(new Uint8Array(aadhaarHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

            console.log("Certificate Hash:", hashHex);
            console.log("Student Wallet:", studentLookup.student.wallet);
            console.log("Aadhaar Hash:", aadhaarHash);

            // Step 3: On-chain + DB (server-signed) to bypass MetaMask UI issues
            // This uses Hardhat Account #1 on the backend, so no MetaMask popup/confirm is needed.
            const formData = new FormData();
            formData.append("file", file);
            formData.append("studentName", studentLookup.student.name);
            formData.append("studentWallet", studentLookup.student.wallet);
            formData.append("aadhaarNumber", aadhaarNumber);
            formData.append("courseTitle", courseTitle);
            formData.append("issuerName", user.name || "Mumbai University");

            const resp = await fetch("http://localhost:5000/issue-certificate-onchain", {
                method: "POST",
                body: formData
            });
            const data = await resp.json();
            if (!resp.ok || !data.success) {
                throw new Error(data.message || "Issuance failed");
            }

            setResult({
                success: true,
                txHash: data.txHash,
                blockNumber: data.blockNumber,
                hash: data.certHash || hashHex,
                studentName: studentLookup.student.name,
                courseTitle
            });
        } catch (error) {
            console.error("Issuance Error:", error);
            let msg = error.message || "Transaction failed";
            
            // Handle specific error cases
            if (error.code === 4001) {
                msg = "Transaction rejected by user. Please try again and click 'Confirm' in MetaMask.";
            } else if (error.code === -32603 || error.message?.includes("user rejected")) {
                msg = "Transaction was cancelled. Please try again and confirm in MetaMask.";
            } else if (msg.includes("Not authorized") || msg.includes("ISSUER_ROLE") || msg.includes("AccessControl")) {
                msg = "Your wallet does not have ISSUER_ROLE. Contact admin to whitelist your wallet (0x0d9A...c1127).";
            } else if (msg.includes("already exists") || msg.includes("Certificate hash already exists")) {
                msg = "A certificate with this exact file hash already exists on the blockchain.";
            } else if (msg.includes("Invalid student") || msg.includes("Invalid student wallet")) {
                msg = "Invalid student wallet address. Ensure the student has registered with their Aadhaar.";
            } else if (msg.includes("MetaMask") || msg.includes("wallet")) {
                // Keep MetaMask-related errors as-is
            } else if (error.reason) {
                msg = error.reason;
            }
            
            setResult({ success: false, error: msg });
        } finally {
            setLoading(false);
        }
    };

    // ─── Main View Logic ───
    // If not approved and not known to have issuer role, show registration/status
    if (hasIssuerRole === false || (requestStatus !== 'APPROVED' && requestStatus !== 'VERIFIED' && hasIssuerRole !== true)) {
        return (
            <div className="max-w-xl mx-auto p-8 mt-16">
                <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-8">
                    <Building size={40} className="mx-auto text-indigo-400 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Institution Registration</h2>
                    <p className="text-sm text-gray-500 mb-6 text-center">Register your institution to start issuing blockchain-verified credentials.</p>

                    {/* Registration / Request Form */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Institution Name</label>
                            <input type="text" value={instName} onChange={(e) => setInstName(e.target.value)} className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500" placeholder="e.g. Mumbai University" />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-semibold text-gray-700">Wallet Address</label>
                                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold text-right">Manual entry or connect MetaMask</span>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualInstWallet}
                                    onChange={(e) => setManualInstWallet(e.target.value)}
                                    className="flex-1 rounded-lg border border-gray-300 p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                    placeholder="0x..."
                                />
                                <button onClick={connectWallet} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold transition-colors border border-slate-200 flex items-center gap-1">
                                    <Wallet size={14} /> Link
                                </button>
                            </div>
                            {wallet && <p className="text-[10px] text-indigo-500 mt-2 font-medium">Connected: {wallet}</p>}
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                onClick={async () => {
                                    if (!instName || !manualInstWallet) return alert('Enter institution name and wallet address');
                                    try {
                                        setLoading(true);
                                        const res = await fetch('http://localhost:5000/institutions/request', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ name: instName, wallet_address: manualInstWallet })
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            setRequestStatus('PENDING');
                                            alert("Approval request sent to Admin!");
                                        } else {
                                            alert(data.message || "Failed to submit request");
                                        }
                                    } catch (e) {
                                        console.error(e);
                                        alert('Failed to submit request');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading || requestStatus === 'PENDING'}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : requestStatus === 'PENDING' ? "Request Pending Approval" : "Request Approval from MeitY"}
                            </button>
                        </div>

                        {requestStatus === 'PENDING' && (
                            <div className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-center animate-pulse">
                                <p className="text-xs uppercase font-bold tracking-widest text-amber-800 mb-1">Awaiting Admin Approval</p>
                                <p className="text-xs text-amber-700">MeitY admin will review and whitelist your wallet soon.</p>
                            </div>
                        )}

                        {requestStatus === 'REJECTED' && (
                            <div className="mt-4 p-4 rounded-xl border border-red-200 bg-red-50 text-center">
                                <p className="text-xs uppercase font-bold tracking-widest text-red-800 mb-1">Request Rejected</p>
                                <p className="text-xs text-red-700">Please contact support or try a different wallet.</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start">
                        <Shield size={18} className="text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-blue-700 leading-relaxed">Only whitelisted institutions can anchor academic credentials on the blockchain.</p>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Checking role... ───
    if (hasIssuerRole === null) {
        return (
            <div className="max-w-lg mx-auto p-8 mt-16 text-center">
                <Loader2 className="animate-spin mx-auto text-indigo-400 h-10 w-10 mb-4" />
                <p className="text-gray-500">Checking ISSUER_ROLE on blockchain...</p>
            </div>
        );
    }

    // ─── Main Issuer Form ───
    const isMismatch = wallet && connectedMetaMask && wallet.toLowerCase() !== connectedMetaMask.toLowerCase();

    return (
        <div className="max-w-4xl mx-auto p-6 mt-4">
            {isMismatch && wallet && connectedMetaMask && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center text-orange-800 text-sm shadow-sm animate-pulse">
                    <AlertTriangle size={16} className="mr-2 text-orange-600" />
                    <span>MetaMask is on <b>{connectedMetaMask.substring(0, 10)}...</b>, but you are logged in as <b>{wallet.substring(0, 10)}...</b>. Transactions will fail.</span>
                </div>
            )}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-6 text-white">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold">Issue Certificate</h1>
                            <p className="text-indigo-100 text-sm mt-1">
                                Issuing as: {user.name}
                                {wallet && ` • ${wallet.substring(0, 6)}...${wallet.substring(38)}`}
                            </p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl flex items-center gap-2">
                            <CheckCircle size={18} />
                            <span className="text-sm font-medium">ISSUER_ROLE ✓</span>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    {!result ? (
                        <form onSubmit={handleIssue} className="space-y-6">
                            {/* Aadhaar Lookup */}
                            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                                <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center">
                                    <Search size={16} className="mr-2 text-indigo-500" />
                                    Step 1: Student Aadhaar Lookup
                                </label>
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        required
                                        maxLength={12}
                                        className="flex-1 rounded-lg border border-gray-300 p-3 text-sm font-mono tracking-wider focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                                        value={aadhaarNumber}
                                        onChange={(e) => { setAadhaarNumber(e.target.value.replace(/\D/g, '')); setStudentLookup(null); }}
                                        placeholder="Enter 12-digit Aadhaar"
                                    />
                                    <button
                                        type="button"
                                        onClick={lookupStudent}
                                        disabled={aadhaarNumber.length < 12 || lookingUp}
                                        className="px-6 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
                                    >
                                        {lookingUp ? <Loader2 className="animate-spin h-4 w-4" /> : "Lookup"}
                                    </button>
                                </div>

                                {/* Lookup Result */}
                                {studentLookup && (
                                    <div className={`mt-3 p-3 rounded-lg text-sm ${studentLookup.found ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                                        {studentLookup.found ? (
                                            <div className="flex items-center">
                                                <UserCheck size={18} className="mr-2 text-green-600" />
                                                <div>
                                                    <span className="font-semibold">{studentLookup.student.name}</span>
                                                    <span className="ml-2 font-mono text-xs text-green-600">{studentLookup.student.wallet.substring(0, 10)}...{studentLookup.student.wallet.substring(38)}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center">
                                                <AlertTriangle size={18} className="mr-2 text-red-500" />
                                                Student not found. They must register with Aadhaar + wallet first.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Course */}
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-1.5">Step 2: Course / Degree</label>
                                <input type="text" required className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="e.g. B.Tech Computer Science" />
                            </div>

                            {/* File Upload */}
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-1.5">Step 3: Upload Original Certificate PDF</label>
                                <div
                                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragActive ? 'border-indigo-500 bg-indigo-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50'}`}
                                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                    onDragLeave={() => setDragActive(false)}
                                    onDrop={handleDrop}
                                >
                                    <input type="file" onChange={(e) => setFile(e.target.files[0])} className="hidden" id="cert-upload" accept=".pdf,.jpg,.png" />
                                    <label htmlFor="cert-upload" className="cursor-pointer flex flex-col items-center">
                                        {file ? (
                                            <>
                                                <FileText size={40} className="text-green-600 mb-2" />
                                                <span className="font-semibold text-gray-900">{file.name}</span>
                                                <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={40} className="text-gray-400 mb-2" />
                                                <span className="text-gray-600 font-medium">Drag & drop or click to browse</span>
                                                <span className="text-xs text-gray-400 mt-1">This file will be hashed and anchored on-chain</span>
                                            </>
                                        )}
                                    </label>
                                </div>
                            </div>

                            {/* Submit */}
                            <div className="space-y-3">
                                <button
                                    type="submit"
                                    disabled={loading || !file || !studentLookup?.found}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold py-3.5 px-6 rounded-xl hover:from-indigo-700 hover:to-blue-700 transition-all flex items-center justify-center shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <><Loader2 className="animate-spin mr-2 h-5 w-5" /> Anchoring on Blockchain...</>
                                    ) : (
                                        <><Shield className="mr-2 h-5 w-5" /> Issue & Anchor Certificate</>
                                    )}
                                </button>
                                {loading && (
                                    <div className="text-center text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <p className="font-semibold text-blue-800 mb-1">MetaMask Transaction Pending</p>
                                        <p className="text-blue-600">1. Click <strong>"Review alert"</strong> in MetaMask popup</p>
                                        <p className="text-blue-600">2. Review transaction details</p>
                                        <p className="text-blue-600">3. Click <strong>"Confirm"</strong> to complete</p>
                                    </div>
                                )}
                            </div>
                        </form>
                    ) : result.success ? (
                        <div className="text-center py-8">
                            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
                                <CheckCircle className="h-12 w-12 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Certificate Issued!</h2>
                            <p className="text-gray-500 mt-2">Permanently anchored on the blockchain.</p>

                            <div className="mt-8 bg-gray-50 rounded-xl p-6 text-left max-w-lg mx-auto space-y-3">
                                <Row label="Student" value={result.studentName} />
                                <Row label="Course" value={result.courseTitle} />
                                <Row label="Tx Hash" value={result.txHash} mono truncate />
                                <Row label="Block" value={`#${result.blockNumber}`} />
                                <div className="pt-2">
                                    <span className="text-xs text-gray-500">Certificate Hash (SHA-256)</span>
                                    <div className="mt-1 p-2 bg-white rounded border font-mono text-xs break-all text-gray-600">{result.hash}</div>
                                </div>
                            </div>

                            <button onClick={() => { setResult(null); setFile(null); setAadhaarNumber(""); setCourseTitle(""); setStudentLookup(null); }} className="mt-8 text-indigo-600 font-medium hover:underline text-sm">
                                ← Issue Another Certificate
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="mx-auto w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
                                <AlertTriangle className="h-12 w-12 text-red-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Issuance Failed</h2>
                            <p className="text-red-600 mt-3 text-sm max-w-md mx-auto bg-red-50 p-4 rounded-lg border border-red-200">{result.error}</p>
                            <button onClick={() => setResult(null)} className="mt-6 text-indigo-600 font-medium hover:underline text-sm">← Try Again</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Row = ({ label, value, mono = false, truncate = false }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-200">
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`text-sm font-semibold text-gray-900 ${mono ? 'font-mono text-xs' : ''} ${truncate ? 'truncate max-w-[200px]' : ''}`}>{value}</span>
    </div>
);

export default IssuerPortal;
