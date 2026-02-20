const { ethers } = require("hardhat");

async function main() {
    const pk = process.env.TARGET_PK;
    if (!pk) {
        console.error("Please set TARGET_PK env var");
        return;
    }

    const wallet = new ethers.Wallet(pk);
    console.log("Address for provided PK:", wallet.address);
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});


