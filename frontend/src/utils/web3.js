import { ethers } from 'ethers';
import ContractAddress from '../contract-address.json';
import CertificateRegistry from '../artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json';

const HARDHAT_NETWORK_ID = '0x7a69'; // 31337

const getProvider = () => {
    if (window.ethereum) {
        return new ethers.BrowserProvider(window.ethereum);
    } else {
        // Read-only provider for public verification without wallet
        return new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    }
};

const switchNetwork = async () => {
    if (window.ethereum) {
        try {
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
                                rpcUrls: ['http://127.0.0.1:8545'],
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
                }
            }
            console.error("Failed to switch network:", error);
        }
    }
};

const getSigner = async () => {
    const provider = getProvider();
    await switchNetwork();
    await provider.send("eth_requestAccounts", []);
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

export { getProvider, getSigner, getContract };
