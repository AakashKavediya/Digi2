import { useState } from "react";
import { Upload, FileText, Loader2, CheckCircle, Search, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Building, Clock, Hash, Copy, RotateCcw, ArrowRight, Box } from "lucide-react";

const VerifierPortal = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [computedHash, setComputedHash] = useState("");
    // QR / Hash verification
    const [hashInput, setHashInput] = useState("");

    const computeHash = async (f) => {
        const buffer = await f.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return '0x' + Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const handleVerify = async () => {
        if (!file) return;
        setLoading(true);
        setResult(null);
        try {
            const hash = await computeHash(file);
            setComputedHash(hash);

            const res = await fetch("http://localhost:5000/verify-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hash })
            });
            const data = await res.json();

            if (data.exists && data.cert) {
                setResult({
                    verified: true,
                    cert: data.cert
                });
            } else {
                setResult({ verified: false });
            }
        } catch (e) {
            console.error(e);
            setResult({ verified: false, error: "Verification failed. " + e.message });
        } finally {
            setLoading(false);
        }
    };

    // Verify by hash string (for QR-scanned hashes)
    const handleHashVerify = async () => {
        if (!hashInput.trim()) return;
        setLoading(true);
        setResult(null);
        setComputedHash(hashInput.trim());
        try {
            const res = await fetch("http://localhost:5000/verify-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hash: hashInput.trim() })
            });
            const data = await res.json();
            if (data.exists && data.cert) {
                setResult({ verified: true, cert: data.cert });
            } else {
                setResult({ verified: false });
            }
        } catch (e) {
            setResult({ verified: false, error: "Verification failed." });
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setFile(null);
        setResult(null);
        setComputedHash("");
        setHashInput("");
    };

    return (
        <div className="max-w-5xl mx-auto p-6 mt-4">
            {/* Title */}
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-gray-900">Certificate Verification</h1>
                <p className="text-sm text-gray-500 mt-1">Upload any certificate file or enter a hash to verify its authenticity on the blockchain</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Upload + Hash Input */}
                <div className="lg:col-span-2 space-y-6">
                    {/* File Upload */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-white flex items-center">
                            <Search size={20} className="mr-3" />
                            <div>
                                <h2 className="font-bold">Method 1: Upload File</h2>
                                <p className="text-amber-100 text-xs">Drop the certificate you received</p>
                            </div>
                        </div>
                        <div className="p-6">
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragActive ? 'border-amber-500 bg-amber-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-amber-300'}`}
                                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                onDragLeave={() => setDragActive(false)}
                                onDrop={(e) => { e.preventDefault(); setDragActive(false); setFile(e.dataTransfer.files[0]); setResult(null); }}
                            >
                                <input type="file" onChange={(e) => { setFile(e.target.files[0]); setResult(null); }} className="hidden" id="verify-upload" />
                                <label htmlFor="verify-upload" className="cursor-pointer flex flex-col items-center">
                                    {file ? (
                                        <>
                                            <FileText size={36} className="text-green-600 mb-2" />
                                            <span className="font-semibold text-gray-900">{file.name}</span>
                                            <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={36} className="text-gray-400 mb-2" />
                                            <span className="text-gray-600 font-medium">Drop PDF, JPG, PNG for verification</span>
                                            <span className="text-xs text-gray-400 mt-1">SHA-256 hash will be computed locally</span>
                                        </>
                                    )}
                                </label>
                            </div>
                            <button onClick={handleVerify} disabled={!file || loading} className="mt-4 w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3 rounded-xl hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-lg shadow-amber-200">
                                {loading ? <><Loader2 className="animate-spin mr-2 h-5 w-5" /> Verifying...</> : <><Search className="mr-2 h-5 w-5" /> Verify File</>}
                            </button>
                        </div>
                    </div>

                    {/* OR: Hash Input (QR scan result) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-violet-500 to-purple-500 px-6 py-4 text-white flex items-center">
                            <Hash size={20} className="mr-3" />
                            <div>
                                <h2 className="font-bold">Method 2: Verify by Hash / QR</h2>
                                <p className="text-violet-100 text-xs">Paste a certificate hash from a QR code</p>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="flex gap-3">
                                <input type="text" className="flex-1 rounded-lg border border-gray-300 p-3 text-sm font-mono focus:border-violet-500 focus:ring-2 focus:ring-violet-200" value={hashInput} onChange={(e) => setHashInput(e.target.value)} placeholder="0x..." />
                                <button onClick={handleHashVerify} disabled={!hashInput.trim() || loading} className="px-6 bg-violet-600 text-white rounded-lg font-medium text-sm hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                                    Verify
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ─── Result ─── */}
                    {result && (
                        <div className={`rounded-2xl overflow-hidden shadow-lg border-2 ${result.verified ? 'border-green-300' : 'border-red-300'}`}>
                            <div className={`px-8 py-6 ${result.verified ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-rose-600'} text-white`}>
                                <div className="flex items-center">
                                    {result.verified ? <ShieldCheck size={36} className="mr-4" /> : <ShieldX size={36} className="mr-4" />}
                                    <div>
                                        <h2 className="text-2xl font-bold">{result.verified ? '✅ Verified Authentic' : '🛑 Tampering Detected!'}</h2>
                                        <p className="text-sm opacity-90 mt-1">
                                            {result.verified ? 'This certificate matches a record on the blockchain.' : 'WARNING: This file does NOT match any blockchain record.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6">
                                {computedHash && (
                                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-semibold text-gray-500">Computed SHA-256</span>
                                            <button onClick={() => navigator.clipboard.writeText(computedHash)} className="text-xs text-indigo-500 hover:underline flex items-center"><Copy size={10} className="mr-1" /> Copy</button>
                                        </div>
                                        <p className="font-mono text-xs text-gray-600 break-all">{computedHash}</p>
                                    </div>
                                )}

                                {result.verified && result.cert && (
                                    <div className="space-y-3">
                                        <Row icon={<GraduationCapIcon />} label="Student" value={result.cert.student_name} />
                                        <Row icon={<GraduationCapIcon />} label="Course" value={result.cert.course_title} />
                                        <Row icon={<Building size={14} className="text-indigo-500" />} label="Issuer" value={result.cert.issuer_name} />
                                        {result.cert.tx_hash && <Row icon={<Box size={14} className="text-violet-500" />} label="Tx Hash" value={result.cert.tx_hash} mono />}
                                        {result.cert.block_number > 0 && <Row icon={<Box size={14} className="text-violet-500" />} label="Block" value={`#${result.cert.block_number}`} />}
                                        <Row icon={<Clock size={14} className="text-gray-400" />} label="Issued" value={new Date(result.cert.timestamp).toLocaleString('en-IN')} />
                                    </div>
                                )}

                                {!result.verified && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                        <div className="flex items-start">
                                            <AlertTriangle size={20} className="text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                                            <div className="text-sm text-red-800">
                                                <p className="font-semibold mb-1">What this means:</p>
                                                <ul className="space-y-1 text-xs">
                                                    <li>• The file content has been altered from the original</li>
                                                    <li>• This could be a forged or tampered certificate</li>
                                                    <li>• The SHA-256 hash does not match any issued credential</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {result && (
                        <button onClick={reset} className="text-sm text-indigo-600 font-medium hover:underline flex items-center justify-center w-full">
                            <RotateCcw size={14} className="mr-1" /> Verify Another File
                        </button>
                    )}
                </div>

                {/* Right: How it works + Demo Files */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center"><ShieldCheck size={18} className="mr-2 text-amber-500" /> How Verification Works</h3>
                        <div className="space-y-4">
                            <Step no="1" title="Upload File" desc="Drop or browse a certificate file (PDF / Image)" />
                            <Step no="2" title="Hash Computation" desc="SHA-256 hash is computed in your browser" />
                            <Step no="3" title="Blockchain Lookup" desc="Hash compared against on-chain records" />
                            <Step no="4" title="Result" desc="Verified (match) or Tampered (mismatch)" />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center"><FileText size={18} className="mr-2 text-indigo-500" /> Tamper Detection Demo</h3>
                        <p className="text-xs text-gray-500 mb-4">Use these after issuing a certificate via the Institution Portal:</p>
                        <div className="space-y-3">
                            <div className="flex items-center p-3 bg-green-50 rounded-lg border border-green-200">
                                <CheckCircle size={16} className="text-green-600 mr-3 flex-shrink-0" />
                                <div>
                                    <span className="text-sm font-semibold text-green-800">original.pdf</span>
                                    <p className="text-xs text-green-600">Upload the same file → VERIFIED ✅</p>
                                </div>
                            </div>
                            <div className="flex items-center p-3 bg-red-50 rounded-lg border border-red-200">
                                <ShieldAlert size={16} className="text-red-600 mr-3 flex-shrink-0" />
                                <div>
                                    <span className="text-sm font-semibold text-red-800">modified.pdf</span>
                                    <p className="text-xs text-red-600">Upload different file → TAMPERED 🛑</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const GraduationCapIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" /><path d="M22 10v6" /><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" /></svg>
);

const Row = ({ icon, label, value, mono = false }) => (
    <div className="flex items-center py-2.5 border-b border-gray-100">
        <div className="mr-3">{icon}</div>
        <span className="text-sm text-gray-500 w-20 flex-shrink-0">{label}</span>
        <span className={`text-sm font-semibold text-gray-900 ${mono ? 'font-mono text-xs truncate' : ''}`}>{value}</span>
    </div>
);

const Step = ({ no, title, desc }) => (
    <div className="flex items-start">
        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold flex-shrink-0 mr-3">{no}</div>
        <div>
            <p className="text-sm font-semibold text-gray-800">{title}</p>
            <p className="text-xs text-gray-500">{desc}</p>
        </div>
    </div>
);

export default VerifierPortal;
