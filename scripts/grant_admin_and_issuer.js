const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    // Read deployed contract address from frontend artifact
    const addrPath = path.join(__dirname, "..", "frontend", "src", "contract-address.json");
    const { address } = JSON.parse(fs.readFileSync(addrPath, "utf8"));

    const [admin] = await hre.ethers.getSigners();
    console.log("Using admin signer:", admin.address);

    const targetAddress = process.env.TARGET_ADDR;
    if (!targetAddress) {
        throw new Error("Please set TARGET_ADDR env var to the wallet address to promote.");
    }
    console.log("Granting roles to:", targetAddress);

    const registry = await hre.ethers.getContractAt("CertificateRegistry", address, admin);

    const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();

    // Grant DEFAULT_ADMIN_ROLE
    const tx1 = await registry.grantRole(DEFAULT_ADMIN_ROLE, targetAddress);
    await tx1.wait();
    console.log("✅ DEFAULT_ADMIN_ROLE granted to", targetAddress);

    // Grant ISSUER_ROLE (via convenience function)
    const tx2 = await registry.grantIssuerRole(targetAddress);
    await tx2.wait();
    console.log("✅ ISSUER_ROLE granted to", targetAddress);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});


