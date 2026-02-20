import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { getSigner, getContract } from "../utils/web3";
import { QRCodeCanvas } from "qrcode.react";
import { Upload, FileText, Check, Shield, Loader2 } from "lucide-react";

const IssuerDashboard = () => {
    const [wallet, setWallet] = useState(null);
    const [file, setFile] = useState(null);
    const [studentName, setStudentName] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [issuedCert, setIssuedCert] = useState(null);

    const connectWallet = async () => {
        try {
            const signer = await getSigner();
            const address = await signer.getAddress();
            setWallet(address);
        } catch (error) {
            console.error(error);
            alert("Failed to connect wallet");
        }
    };

    const handleIssue = async () => {
        if (!file || !studentName || !wallet) return;
        setLoading(true);
        setStatus("Uploading to IPFS...");

        try {
            // 1. Upload to Backend (IPFS + Hash)
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("http://localhost:5000/upload", {
                method: "POST",
                body: formData
            });

            if (!response.ok) throw new Error("Upload failed");

            const data = await response.json();
            const { hash, cid } = data; // hash should be 0x...

            setStatus("Waiting for Wallet Signature...");

            // 2. Interact with Smart Contract
            const contract = await getContract(true); // with signer

            // Check if already exists to avoid revert
            // const exists = await contract.verifyCertificate(hash);
            // if(exists[0]) {
            //    throw new Error("Certificate already issued with this hash");
            // }

            const tx = await contract.issueCertificate(hash, studentName, cid);

            setStatus("Confirming Transaction...");
            await tx.wait();

            setIssuedCert({
                studentName,
                hash,
                cid,
                txHash: tx.hash
            });

            setStatus("Success!");
            setFile(null);
            setStudentName("");

        } catch (error) {
            console.error(error);
            setStatus("Error: " + (error.reason || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-8">
            <header className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                    <Shield className="w-8 h-8 text-blue-600" />
                    <h1 className="text-2xl font-bold text-gray-800">Issuer Portal</h1>
                </div>
                {!wallet ? (
                    <button
                        onClick={connectWallet}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors shadow-md"
                    >
                        Connect MetaMask
                    </button>
                ) : (
                    <div className="bg-white px-4 py-2 rounded-lg shadow border border-gray-200 flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="font-mono text-sm text-gray-600">{wallet}</span>
                    </div>
                )}
            </header>

            <main className="flex-grow max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Issue Form */}
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                    <h2 className="text-xl font-bold mb-6 text-gray-700">Issue New Certificate</h2>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
                            <input
                                type="text"
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="e.g. John Doe"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Certificate (PDF)</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                                <input
                                    type="file"
                                    onChange={(e) => setFile(e.target.files[0])}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                {file ? (
                                    <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                                        <FileText size={20} />
                                        {file.name}
                                    </div>
                                ) : (
                                    <div className="text-gray-400 flex flex-col items-center">
                                        <Upload className="mb-2" />
                                        <span>Click to Upload</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleIssue}
                            disabled={!wallet || !file || !studentName || loading}
                            className={`w-full py-3 rounded-lg font-bold text-white transition-all flex justify-center items-center gap-2
                                ${(!wallet || !file || !studentName) ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}
                            `}
                        >
                            {loading && <Loader2 className="animate-spin" size={20} />}
                            {loading ? status : "Sign & Issue Certificate"}
                        </button>

                        {status && !loading && (
                            <p className={`text-center text-sm font-medium ${status.includes("Error") ? "text-red-500" : "text-green-600"}`}>
                                {status}
                            </p>
                        )}
                    </div>
                </div>

                {/* Success / Result View */}
                <div className="flex flex-col gap-6">
                    {issuedCert ? (
                        <div className="bg-white p-8 rounded-2xl shadow-lg border border-green-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 bg-green-100 rounded-bl-2xl">
                                <Check className="text-green-600" />
                            </div>

                            <h3 className="text-lg font-bold text-green-800 mb-4">Certificate Issued Successfully!</h3>

                            <div className="space-y-4 text-sm text-gray-600">
                                <div>
                                    <p className="font-semibold text-gray-800">Student</p>
                                    <p>{issuedCert.studentName}</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-800">Transaction Hash</p>
                                    <p className="font-mono text-xs break-all bg-gray-100 p-2 rounded">{issuedCert.txHash}</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-800">Certificate Hash</p>
                                    <p className="font-mono text-xs break-all bg-gray-100 p-2 rounded">{issuedCert.hash}</p>
                                </div>
                            </div>

                            <div className="mt-6 flex flex-col items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <QRCodeCanvas
                                    value={issuedCert.hash}
                                    size={128}
                                    level={"H"}
                                />
                                <p className="mt-2 text-xs text-gray-500 font-mono">Scan for Verification</p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                            <Shield className="w-16 h-16 mb-4 text-gray-200" />
                            <p>Connect wallet and issue a certificate to see details here.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default IssuerDashboard;
