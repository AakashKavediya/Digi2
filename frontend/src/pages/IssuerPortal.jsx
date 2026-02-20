import { useState, useEffect } from "react";
import { Upload, FileText, Loader2, CheckCircle, Shield, Hash, CreditCard, AlertTriangle, Search, UserCheck, Building } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getContract } from "../utils/web3";
import { ethers } from "ethers";

const IssuerPortal = ({ wallet, connectWallet }) => {
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

    // Check if connected wallet has ISSUER_ROLE
    useEffect(() => {
        const checkRole = async () => {
            if (!wallet) { setHasIssuerRole(null); return; }
            try {
                const contract = await getContract(false);
                const result = await contract.isIssuer(wallet);
                setHasIssuerRole(result);
            } catch (e) {
                console.error("Role check failed:", e);
                setHasIssuerRole(false);
            }
        };
        checkRole();
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

            // Step 3: Blockchain TX
            const contract = await getContract(true);
            const tx = await contract.issueCertificate(
                hashHex,
                studentLookup.student.wallet,
                aadhaarHash,
                studentLookup.student.name,
                courseTitle,
                "ipfs://pending"
            );
            const receipt = await tx.wait();

            // Step 4: Save to backend
            const formData = new FormData();
            formData.append("file", file);
            formData.append("studentName", studentLookup.student.name);
            formData.append("studentWallet", studentLookup.student.wallet);
            formData.append("aadhaarHash", aadhaarHash);
            formData.append("courseTitle", courseTitle);
            formData.append("issuerName", user.name || "Mumbai University");
            formData.append("issuerWallet", wallet);
            formData.append("txHash", tx.hash);
            formData.append("blockNumber", receipt.blockNumber.toString());

            await fetch("http://localhost:5000/issue-certificate", { method: "POST", body: formData });

            setResult({
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                hash: hashHex,
                studentName: studentLookup.student.name,
                courseTitle
            });
        } catch (error) {
            console.error("Issuance Error:", error);
            let msg = error.message || "Transaction failed";
            if (msg.includes("Not authorized") || msg.includes("ISSUER_ROLE")) {
                msg = "Your wallet does not have ISSUER_ROLE. Ask Admin (Account #0) to whitelist your wallet.";
            } else if (msg.includes("already exists")) {
                msg = "A certificate with this exact file hash already exists on the blockchain.";
            } else if (msg.includes("Invalid student")) {
                msg = "Invalid student wallet address. Ensure the student has registered.";
            }
            setResult({ success: false, error: msg });
        } finally {
            setLoading(false);
        }
    };

    // ─── Wallet not connected ───
    if (!wallet) {
        return (
            <div className="max-w-lg mx-auto p-8 mt-16 text-center">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12">
                    <Building size={48} className="mx-auto text-indigo-400 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Connect Institution Wallet</h2>
                    <p className="text-sm text-gray-500 mb-6">Connect MetaMask Account #1 to issue certificates.</p>
                    <button onClick={connectWallet} className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:from-indigo-700 hover:to-blue-700 transition-all shadow-lg shadow-indigo-200">
                        Connect MetaMask
                    </button>
                </div>
            </div>
        );
    }

    // ─── No ISSUER_ROLE ───
    if (hasIssuerRole === false) {
        return (
            <div className="max-w-lg mx-auto p-8 mt-16 text-center">
                <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-12">
                    <AlertTriangle size={48} className="mx-auto text-red-400 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Not Authorized as Issuer</h2>
                    <p className="text-sm text-gray-500 mb-4">Your wallet does not have <code className="bg-red-50 px-2 py-1 rounded text-red-600 text-xs font-mono">ISSUER_ROLE</code> on the blockchain.</p>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left text-sm text-amber-800">
                        <p className="font-semibold mb-1">How to fix:</p>
                        <ol className="list-decimal list-inside space-y-1 text-xs">
                            <li>Login as <strong>Admin</strong> (admin@demo.com)</li>
                            <li>Switch MetaMask to <strong>Account #0</strong> (deployer)</li>
                            <li>Go to <strong>University Whitelist</strong></li>
                            <li>Add your Institution wallet: <code className="bg-white px-1 rounded">{wallet.substring(0, 10)}...{wallet.substring(38)}</code></li>
                        </ol>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">Connected wallet: {wallet}</p>
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
    return (
        <div className="max-w-4xl mx-auto p-6 mt-4">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-6 text-white">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold">Issue Certificate</h1>
                            <p className="text-indigo-100 text-sm mt-1">Issuing as: {user.name} • {wallet.substring(0, 6)}...{wallet.substring(38)}</p>
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
