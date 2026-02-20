import { useState } from "react";
import { getContract } from "../utils/web3";
import { Upload, CheckCircle, XCircle, ShieldCheck, ShieldAlert } from "lucide-react";

const PublicVerify = () => {
    const [file, setFile] = useState(null);
    const [hashInput, setHashInput] = useState("");
    const [verificationResult, setVerificationResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
            setVerificationResult(null);
        }
    };

    const verifyMetadata = async (hash) => {
        try {
            const contract = await getContract();
            // result: [exists, name, cid, issuer, time, revoked]
            const result = await contract.verifyCertificate(hash);

            if (result[0]) { // exists
                return {
                    valid: !result[5], // not revoked
                    revoked: result[5],
                    name: result[1],
                    issuer: result[3],
                    timestamp: Number(result[4]) * 1000
                };
            }
            return null;
        } catch (e) {
            console.error("Contract Verify Error:", e);
            return null;
        }
    }

    const verify = async () => {
        setLoading(true);
        setVerificationResult(null);

        try {
            let hashToVerify = hashInput;

            if (file) {
                // Upload to backend to get hash (simulating client-side hashing for consistency with issuance)
                const formData = new FormData();
                formData.append("file", file);

                const response = await fetch("http://localhost:5000/verify-file", {
                    method: "POST",
                    body: formData
                });

                if (!response.ok) throw new Error("Backend verification failed");

                const data = await response.json();
                hashToVerify = data.hash;
            }

            if (!hashToVerify) {
                alert("Please provide a file or a hash");
                setLoading(false);
                return;
            }

            console.log("Verifying Hash:", hashToVerify);
            const blockchainData = await verifyMetadata(hashToVerify);

            if (blockchainData) {
                setVerificationResult({
                    status: blockchainData.revoked ? "REVOKED" : "VALID",
                    ...blockchainData,
                    hash: hashToVerify
                });
            } else {
                setVerificationResult({
                    status: "INVALID",
                    hash: hashToVerify
                });
            }

        } catch (error) {
            console.error(error);
            alert("Verification process failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center py-12 px-4">
            <div className="max-w-3xl w-full text-center mb-10">
                <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
                    Credential Verification
                </h1>
                <p className="text-gray-600">
                    Verify academic certificates instantly on the blockchain. Tamper-proof and secure.
                </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden">
                <div className="p-8">
                    {/* Input Methods */}
                    <div className="space-y-6">

                        {/* File Upload */}
                        <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-blue-400'}`}>
                            <input
                                type="file"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                                accept=".pdf,.png,.jpg,.jpeg"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                                <Upload className={`w-12 h-12 mb-3 ${file ? 'text-green-600' : 'text-gray-400'}`} />
                                <span className="text-lg font-medium text-gray-700">
                                    {file ? file.name : "Drop certificate file here"}
                                </span>
                                <span className="text-sm text-gray-500 mt-1">or click to browse</span>
                            </label>
                        </div>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-gray-200"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">OR VERIFY BY HASH</span>
                            <div className="flex-grow border-t border-gray-200"></div>
                        </div>

                        {/* Hash Input */}
                        <div>
                            <input
                                type="text"
                                value={hashInput}
                                onChange={(e) => { setHashInput(e.target.value); setFile(null); }}
                                placeholder="Enter Certificate Hash (0x...)"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                disabled={!!file}
                            />
                        </div>

                        <button
                            onClick={verify}
                            disabled={loading || (!file && !hashInput)}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading ? "Verifying Blockchain Records..." : "Verify Certificate"}
                        </button>
                    </div>
                </div>

                {/* Results Section */}
                {verificationResult && (
                    <div className={`p-6 border-t ${verificationResult.status === 'VALID' ? 'bg-green-50 border-green-200' :
                            verificationResult.status === 'REVOKED' ? 'bg-yellow-50 border-yellow-200' :
                                'bg-red-50 border-red-200'
                        }`}>
                        <div className="flex items-center gap-4 mb-4">
                            {verificationResult.status === 'VALID' && <ShieldCheck className="w-10 h-10 text-green-600" />}
                            {verificationResult.status === 'REVOKED' && <ShieldAlert className="w-10 h-10 text-yellow-600" />}
                            {verificationResult.status === 'INVALID' && <XCircle className="w-10 h-10 text-red-600" />}

                            <div>
                                <h3 className={`text-xl font-bold ${verificationResult.status === 'VALID' ? 'text-green-800' :
                                        verificationResult.status === 'REVOKED' ? 'text-yellow-800' :
                                            'text-red-800'
                                    }`}>
                                    Certificate is {verificationResult.status}
                                </h3>
                                <p className="text-sm text-gray-600">
                                    {verificationResult.status === 'INVALID'
                                        ? "This hash does not exist in the registry."
                                        : "Verified against Ethereum Blockchain."}
                                </p>
                            </div>
                        </div>

                        {verificationResult.status !== 'INVALID' && (
                            <div className="space-y-2 text-sm text-gray-700 bg-white/50 p-4 rounded-lg">
                                <div className="flex justify-between">
                                    <span className="font-semibold">Student Name:</span>
                                    <span>{verificationResult.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Issuer:</span>
                                    <span className="font-mono text-xs" title={verificationResult.issuer}>
                                        {verificationResult.issuer.substring(0, 10)}...{verificationResult.issuer.substring(38)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Issued On:</span>
                                    <span>{new Date(verificationResult.timestamp).toLocaleDateString()}</span>
                                </div>
                                <div className="pt-2 border-t border-gray-200 mt-2">
                                    <span className="font-semibold block mb-1">Hash:</span>
                                    <span className="font-mono text-xs break-all text-gray-500 block">
                                        {verificationResult.hash}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicVerify;
