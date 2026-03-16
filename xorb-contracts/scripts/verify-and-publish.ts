import { run } from "hardhat";

async function main() {
    const WRAPPED_XORB_ADDRESS = process.env.WRAPPED_XORB_ADDRESS || "0x0000000000000000000000000000000000000000";
    const POP_TRACKER_ADDRESS = process.env.POP_TRACKER_ADDRESS || "0x0000000000000000000000000000000000000000";
    const XORB_TOKEN_ADDRESS = process.env.XORB_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";
    const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || "0x0000000000000000000000000000000000000000";
    const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || "0x0000000000000000000000000000000000000000";
    const CHAINLINK_ROUTER = process.env.CHAINLINK_ROUTER || "0x0000000000000000000000000000000000000000";

    console.log("Starting contract verification...");

    // Verify WrappedXORB
    if (WRAPPED_XORB_ADDRESS && WRAPPED_XORB_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        try {
            console.log(`Verifying WrappedXORB at ${WRAPPED_XORB_ADDRESS}...`);
            await run("verify:verify", {
                address: WRAPPED_XORB_ADDRESS,
                constructorArguments: [XORB_TOKEN_ADDRESS, "Wrapped XORB", "USDC"],
            });
            console.log("WrappedXORB verified successfully!");
        } catch (e: any) {
            if (e.message.toLowerCase().includes("already verified")) {
                console.log("WrappedXORB is already verified.");
            } else {
                console.error("Error verifying WrappedXORB:", e);
            }
        }
    }

    // Verify PoPTracker
    if (POP_TRACKER_ADDRESS && POP_TRACKER_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        try {
            console.log(`Verifying PoPTracker at ${POP_TRACKER_ADDRESS}...`);
            await run("verify:verify", {
                address: POP_TRACKER_ADDRESS,
                constructorArguments: [WRAPPED_XORB_ADDRESS, TREASURY_ADDRESS, ADMIN_ADDRESS, CHAINLINK_ROUTER],
            });
            console.log("PoPTracker verified successfully!");
        } catch (e: any) {
            if (e.message.toLowerCase().includes("already verified")) {
                console.log("PoPTracker is already verified.");
            } else {
                console.error("Error verifying PoPTracker:", e);
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

