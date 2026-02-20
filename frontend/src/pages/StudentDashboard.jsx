import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Copy, CheckCircle, ExternalLink, XCircle } from "lucide-react";
import { getProvider, getContract } from "../utils/web3";

const StudentDashboard = () => {
    const [certificate, setCertificate] = useState(null);
    const [hashInput, setHashInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const fetchCertificate = async () => {
        if (!hashInput) return;
        setLoading(true);
        setError("");

        try {
            // Check blockchain
            const contract = await getContract();
            const result = await contract.verifyCertificate(hashInput);

            // Result format: [exists(bool), studentName, ipfsCID, issuer, timestamp, revoked]
            // Note: Adjust index based on return structure in Solidity
            const [exists, studentName, ipfsCID, issuer, timestamp, revoked] = result;

            if (exists) {
                setCertificate({
                    studentName,
                    ipfsCID,
                    issuer,
                    timestamp: Number(timestamp) * 1000, // Convert to ms
                    revoked,
                    hash: hashInput
                });
            } else {
                setError("Certificate not found on blockchain.");
                setCertificate(null);
            }
        } catch (err) {
            console.error(err);
            setError("Error fetching certificate. Please check the hash.");
            setCertificate(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Student Dashboard</h1>

            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                        Enter Certificate Hash
                    </label>
                    <input
                        type="text"
                        value={hashInput}
                        onChange={(e) => setHashInput(e.target.value)}
                        placeholder="0x123..."
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                </div>

                <button
                    onClick={fetchCertificate}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mb-4"
                >
                    {loading ? "Searching..." : "Access Certificate"}
                </button>

                {error && <p className="text-red-500 text-xs italic">{error}</p>}
            </div>

            {certificate && (
                <div className="mt-8 bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl border border-gray-200">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">{certificate.studentName}</h2>
                            <p className="text-gray-500 text-sm">Issued by: {certificate.issuer}</p>
                        </div>
                        {certificate.revoked ? (
                            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded border border-red-400">REVOKED</span>
                        ) : (
                            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded border border-green-400">VALID</span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                        <div className="p-3 bg-gray-50 rounded">
                            <span className="block text-gray-500">Issue Date</span>
                            <span className="font-medium">{new Date(certificate.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div className="p-3 bg-gray-50 rounded">
                            <span className="block text-gray-500">Certificate Hash</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono truncate w-32">{certificate.hash}</span>
                                <button onClick={() => navigator.clipboard.writeText(certificate.hash)} className="text-blue-500 hover:text-blue-700">
                                    <Copy size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center">
                        {/* In a real production app, we would use an IPFS gateway. For local dev, we might mock or use a public gateway */}
                        <a
                            href={`https://ipfs.io/ipfs/${certificate.ipfsCID}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-full transition-colors"
                        >
                            View Document on IPFS <ExternalLink size={18} />
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;
