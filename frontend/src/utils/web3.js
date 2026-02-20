import { ethers } from 'ethers';
import ContractAddress from '../contract-address.json';
import CertificateRegistry from '../artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json';

const HARDHAT_NETWORK_ID = '0x7a69'; // 31337
const HARDHAT_RPC = 'http://127.0.0.1:8545';

const getProvider = () => {
    if (window.ethereum) {
        return new ethers.BrowserProvider(window.ethereum);
    } else {
        // Read-only provider for public verification without wallet
        return new ethers.JsonRpcProvider(HARDHAT_RPC);
    }
};

const testHardhatConnection = async () => {
    try {
        const testProvider = new ethers.JsonRpcProvider(HARDHAT_RPC);
        const blockNumber = await testProvider.getBlockNumber();
        console.log('✓ Hardhat RPC connected. Block:', blockNumber);
        return true;
    } catch (error) {
        console.warn('⚠ Hardhat RPC not available:', error.message);
        return false;
    }
};

const switchNetwork = async () => {
    if (window.ethereum) {
        try {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            if (chainId === HARDHAT_NETWORK_ID) {
                return; // Already on Hardhat
            }
            
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: HARDHAT_NETWORK_ID }],
            });
        } catch (error) {
            // This error code indicates that the chain has not been added to MetaMask.
            if (error.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: HARDHAT_NETWORK_ID,
                                chainName: 'Hardhat Localhost',
                                rpcUrls: [HARDHAT_RPC],
                                nativeCurrency: {
                                    name: 'ETH',
                                    symbol: 'ETH',
                                    decimals: 18
                                }
                            },
                        ],
                    });
                } catch (addError) {
                    console.error("Failed to add network:", addError);
                    throw addError;
                }
            } else {
                console.error("Failed to switch network:", error);
                throw error;
            }
        }
    }
};

const getSigner = async () => {
    const provider = getProvider();
    await switchNetwork();
    try {
        await provider.send("eth_requestAccounts", []);
    } catch (error) {
        console.error("Failed to request accounts:", error);
        throw error;
    }
    return provider.getSigner();
};

const getContract = async (withSigner = false) => {
    const provider = getProvider();
    const address = ContractAddress.address;
    const abi = CertificateRegistry.abi;

    if (withSigner) {
        const signer = await getSigner();
        return new ethers.Contract(address, abi, signer);
    } else {
        return new ethers.Contract(address, abi, provider);
    }
};

export { getProvider, getSigner, getContract, testHardhatConnection };
