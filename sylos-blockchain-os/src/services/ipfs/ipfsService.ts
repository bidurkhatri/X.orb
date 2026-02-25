import CryptoJS from 'crypto-js';

// Environment variables for IPFS pinning configuration
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface UploadResult {
    success: boolean;
    cid?: string;
    size?: number;
    error?: string;
}

/**
 * Encrypts a file using AES symmetric encryption with the user's wallet signature as the key
 * @param file The literal File object
 * @param secretKey The symmetric key (ideally derived from an EIP-712 wallet signature)
 */
export const encryptFile = async (file: File, secretKey: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const fileData = e.target?.result;
                if (!fileData) throw new Error("File read failed");
                const encrypted = CryptoJS.AES.encrypt(fileData.toString(), secretKey).toString();
                const encryptedBlob = new Blob([encrypted], { type: 'application/octet-stream' });
                resolve(encryptedBlob);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Uploads an encrypted file to IPFS via Pinata.
 * If credentials are missing, it safely simulates the IPFS network delay and generates a pseudo-CID to ensure the OS prototype remains functional.
 * @param file The blob/file to upload
 */
export const pinToIPFS = async (file: Blob | File, filename: string): Promise<UploadResult> => {
    if (!SUPABASE_URL) {
        console.warn("⚠️ VITE_SUPABASE_URL is not defined. Simulating IPFS Network Pinning...");
        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, 2500));

        // Generate a pseudo-realistic CIDv1 for the mock
        const randomHash = Array.from({ length: 44 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        return {
            success: true,
            cid: `bafybei` + randomHash,
            size: file.size
        };
    }

    try {
        const formData = new FormData();
        formData.append('file', file, filename);

        const res = await fetch(`${SUPABASE_URL}/functions/v1/api-proxy?action=pin-to-ipfs`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                apikey: SUPABASE_ANON_KEY,
            },
            body: formData
        });

        if (!res.ok) {
            throw new Error(`IPFS Pinning failed: ${res.statusText}`);
        }

        const data = await res.json();
        return {
            success: true,
            cid: data.IpfsHash,
            size: data.PinSize
        };

    } catch (error: any) {
        console.error("IPFS Upload Error:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Resolves an IPFS CID to a verifiable HTTP gateway URL.
 */
export const getGatewayUrl = (cid: string) => {
    return `${PINATA_GATEWAY}/${cid}`;
};
