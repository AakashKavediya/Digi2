import { ethers } from 'ethers';
import ContractAddress from '../contract-address.json';
import CertificateRegistry from '../artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json';

const HARDHAT_NETWORK_ID = '0x7a69'; // 31337

const RPC_URL = 'http://127.0.0.1:8545';

const getProvider = async () => {
    // Prefer window.ethereum when available but validate connectivity
    if (window.ethereum) {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        try {
            // quick chain check with timeout to avoid hanging
            const chainId = await Promise.race([
                browserProvider.send('eth_chainId', []),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]);
            return browserProvider;
        } catch (err) {
            console.warn('window.ethereum present but unreachable (MetaMask->RPC). Falling back to read-only RPC.', err);
        }
    }

    // Read-only provider for public verification without wallet
    // Disable polling to prevent continuous RPC errors if node is down
    const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
    provider.pollingInterval = 1000000; // Effectively disable polling
    return provider;
};

const switchNetwork = async () => {
    if (window.ethereum) {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: HARDHAT_NETWORK_ID }],
            });
        } catch (error) {
            // Non-fatal: log and continue (demo mode)
            if (error.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: HARDHAT_NETWORK_ID,
                                chainName: 'Hardhat Localhost',
                                rpcUrls: [RPC_URL],
                                nativeCurrency: {
                                    name: 'ETH',
                                    symbol: 'ETH',
                                    decimals: 18
                                }
                            },
                        ],
                    });
                } catch (addError) {
                    console.warn('Failed to add network to MetaMask (continuing in read-only/demo mode):', addError);
                }
            } else {
                console.warn('Failed to switch network (continuing in read-only/demo mode):', error);
            }
        }
    }
};

const getSigner = async () => {
    const provider = await getProvider();
    // attempt to switch network but do not fail hard if MetaMask cannot reach node
    try {
        await switchNetwork();
    } catch (e) {
        console.warn('Network switch failed:', e);
    }

    // Request accounts from MetaMask; if this fails, bubble error so UI can handle gracefully
    if (provider instanceof ethers.JsonRpcProvider) {
        throw new Error('No wallet available (read-only provider in use)');
    }

    try {
        await provider.send('eth_requestAccounts', []);
        return provider.getSigner();
    } catch (err) {
        console.warn('eth_requestAccounts failed:', err);
        throw err;
    }
};

const getContract = async (withSigner = false) => {
    const provider = await getProvider();
    // Deploy script saves as { "address": "0x..." }
    const address = ContractAddress.address;
    const abi = CertificateRegistry.abi;

    if (withSigner) {
        if (!window.ethereum) throw new Error("MetaMask not found.");
        // Ensure network is switched before creating signer
        await switchNetwork();
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        const signer = await browserProvider.getSigner();
        return new ethers.Contract(address, abi, signer);
    }

    return new ethers.Contract(address, abi, provider);
};

export { getProvider, getSigner, getContract };
