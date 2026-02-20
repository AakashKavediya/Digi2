const hre = require("hardhat");

async function main() {
    const signers = await hre.ethers.getSigners();
    const deployer = signers[0];

    console.log("═══════════════════════════════════════════════");
    console.log("  DigiLocker 2.0 — Contract Deployment");
    console.log("═══════════════════════════════════════════════");
    console.log("\nDeployer (ADMIN):", deployer.address);

    const CertificateRegistry = await hre.ethers.getContractFactory("CertificateRegistry");
    const registry = await CertificateRegistry.deploy();
    await registry.waitForDeployment();

    const contractAddress = await registry.getAddress();
    console.log("Contract deployed to:", contractAddress);

    // The deployer automatically has DEFAULT_ADMIN_ROLE from constructor.
    // They can grant ISSUER_ROLE to any MetaMask wallet via the Admin UI.
    //
    // For easier demo setup, also grant ISSUER_ROLE to Account #1 
    // (only works if user imports Hardhat #1 into MetaMask)
    if (signers.length > 1) {
        const tx = await registry.grantIssuerRole(signers[1].address);
        await tx.wait();
        console.log("  ✔ ISSUER_ROLE granted to Account #1:", signers[1].address);
    }

    console.log("\n─── IMPORTANT ───");
    console.log("Admin Account #0:", deployer.address);
    console.log("Import this private key into MetaMask to act as Admin.");
    console.log("Then use Admin UI to grant ISSUER_ROLE to your Institution wallet.\n");

    // Save contract address to frontend
    const fs = require("fs");
    const frontendPath = __dirname + "/../frontend/src";
    if (!fs.existsSync(frontendPath)) {
        fs.mkdirSync(frontendPath, { recursive: true });
    }

    fs.writeFileSync(
        frontendPath + "/contract-address.json",
        JSON.stringify({ address: contractAddress }, undefined, 2)
    );

    console.log("✅ Contract address saved to frontend/src/contract-address.json");
    console.log("═══════════════════════════════════════════════\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
