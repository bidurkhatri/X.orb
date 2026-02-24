import { run } from "hardhat";

async function main() {
    const WRAPPED_SYLOS_ADDRESS = process.env.WRAPPED_SYLOS_ADDRESS || "0x0000000000000000000000000000000000000000";
    const POP_TRACKER_ADDRESS = process.env.POP_TRACKER_ADDRESS || "0x0000000000000000000000000000000000000000";
    const SYLOS_TOKEN_ADDRESS = process.env.SYLOS_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";
    const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || "0x0000000000000000000000000000000000000000";
    const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || "0x0000000000000000000000000000000000000000";
    const CHAINLINK_ROUTER = process.env.CHAINLINK_ROUTER || "0x0000000000000000000000000000000000000000";

    console.log("Starting contract verification...");

    // Verify WrappedSYLOS
    if (WRAPPED_SYLOS_ADDRESS && WRAPPED_SYLOS_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        try {
            console.log(`Verifying WrappedSYLOS at ${WRAPPED_SYLOS_ADDRESS}...`);
            await run("verify:verify", {
                address: WRAPPED_SYLOS_ADDRESS,
                constructorArguments: [SYLOS_TOKEN_ADDRESS, "Wrapped SYLOS", "wSYLOS"],
            });
            console.log("WrappedSYLOS verified successfully!");
        } catch (e: any) {
            if (e.message.toLowerCase().includes("already verified")) {
                console.log("WrappedSYLOS is already verified.");
            } else {
                console.error("Error verifying WrappedSYLOS:", e);
            }
        }
    }

    // Verify PoPTracker
    if (POP_TRACKER_ADDRESS && POP_TRACKER_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        try {
            console.log(`Verifying PoPTracker at ${POP_TRACKER_ADDRESS}...`);
            await run("verify:verify", {
                address: POP_TRACKER_ADDRESS,
                constructorArguments: [WRAPPED_SYLOS_ADDRESS, TREASURY_ADDRESS, ADMIN_ADDRESS, CHAINLINK_ROUTER],
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

