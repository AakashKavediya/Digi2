import { useState, useEffect } from "react";
import { Copy, Wifi, ShieldCheck, Wallet } from "lucide-react";
import { getProvider } from "../../utils/web3";

const Header = ({ toggleSidebar }) => {
    const [wallet, setWallet] = useState(null);
    const [network, setNetwork] = useState("Unknown");

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.request({ method: 'eth_accounts' })
                .then(accounts => setWallet(accounts[0] || null));

            window.ethereum.on('accountsChanged', (accounts) => setWallet(accounts[0] || null));

            // Check Network
            window.ethereum.request({ method: 'eth_chainId' })
                .then(chainId => {
                    if (chainId === '0x7a69') setNetwork('Hardhat Local');
                    else setNetwork('Unknown Network');
                });
        }
    }, []);

    const connectWallet = async () => {
        if (window.ethereum) {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            setWallet(accounts[0]);
        }
    };

    return (
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-40">
            <div className="flex items-center">
                <button onClick={toggleSidebar} className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
                    <span className="sr-only">Open sidebar</span>
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <div className="flex items-center ml-4 lg:ml-0">
                    <img className="h-8 w-auto mr-3" src="https://upload.wikimedia.org/wikipedia/en/9/95/Digital_India_logo.svg" alt="MeitY Logo" />
                    <span className="text-gray-900 font-bold text-lg hidden sm:block">Ministry of Electronics & IT</span>
                    <span className="ml-3 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">ADMIN</span>
                </div>
            </div>

            <div className="flex items-center space-x-4">
                <div className="hidden md:flex items-center space-x-2 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                    <div className={`w-2 h-2 rounded-full ${network === 'Hardhat Local' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span>{network}</span>
                </div>

                {wallet ? (
                    <div className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-slate-800 transition-colors cursor-pointer group">
                        <Wallet size={16} />
                        <span className="font-mono text-sm">{wallet.substring(0, 6)}...{wallet.substring(38)}</span>
                    </div>
                ) : (
                    <button
                        onClick={connectWallet}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                        Connect Wallet
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
