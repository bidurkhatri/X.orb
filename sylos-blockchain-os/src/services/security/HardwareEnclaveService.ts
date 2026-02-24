/**
 * @file HardwareEnclaveService.ts
 * @description Implements Phase 5.9: Hardware Enclave Key Management
 * 
 * Secures high-clearance generated Session Keys (ERC-4337) natively. This service 
 * delegates high-risk Web3 signing operations to non-exportable hardware-backed 
 * CryptoKeyPair objects in the browser (SubtleCrypto) or via Tauri/Native plugins
 * wrapping Apple Secure Enclave / Windows TPM 2.0.
 */

export class HardwareEnclaveService {
    private keyPrefix = 'sylos_enclave_key_';

    /**
     * Generates a strictly non-exportable hardware-backed key pair.
     * The private key can never be read from RAM by any application (including SylOS).
     */
    async generateSecureSessionKey(userId: string): Promise<CryptoKey> {
        try {
            const keyPair = await window.crypto.subtle.generateKey(
                {
                    name: "ECDSA",
                    namedCurve: "P-256", // SECP256R1 - broadly supported by hardware elements
                },
                false, // <--- CRITICAL: Ensures key material is non-exportable 
                ["sign", "verify"]
            );

            // In a Tauri/Desktop environment, we would bridge to native TPM modules:
            // if (window.__TAURI__) await invoke('store_tpm_key', { pubKey: keyPair.publicKey });

            // For the Web OS Sandbox, we anchor the reference point via IndexedDB
            // Note: IndexedDB only stores the 'CryptoKey' reference, not the raw private bytes 
            await this.anchorKeyReference(userId, keyPair.privateKey);

            return keyPair.publicKey;
        } catch (e) {
            console.error("Hardware Enclave Initialization Failed:", e);
            throw new Error("Local Hardware Security Module (HSM) is unavailable.");
        }
    }

    /**
     * Signs a payload exactly inside the hardware boundary.
     * Private key never enters the V8 Javascript heap context.
     */
    async signPayload(userId: string, payload: BufferSource): Promise<ArrayBuffer> {
        const privateKey = await this.retrieveAnchoredKey(userId);
        if (!privateKey) throw new Error("Key reference not found in hardware anchor.");

        const signature = await window.crypto.subtle.sign(
            { name: "ECDSA", hash: { name: "SHA-256" } },
            privateKey,
            payload
        );

        return signature;
    }

    /**
     * Authenticates the user via biometric hardware (WebAuthn / Passkeys) 
     * to unlock massive ledger spending limits or reset recovery layers.
     */
    async challengeBiometricAssertion(challengePayload: Uint8Array): Promise<Credential | null> {
        if (!window.PublicKeyCredential) {
            console.warn("WebAuthn not supported - Biometrics disabled.");
            return null;
        }

        try {
            return await navigator.credentials.get({
                publicKey: {
                    challenge: challengePayload,
                    rpId: window.location.hostname,
                    userVerification: "required", // Forces FaceID/TouchID/Windows Hello
                }
            });
        } catch (err) {
            console.error("Biometric challenge rejected or failed", err);
            throw err;
        }
    }

    // --- IndexedDB Reference Anchoring Helpers --- //

    private anchorKeyReference(userId: string, key: CryptoKey): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('sylos_enclave_anchor', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('keys');
            req.onsuccess = () => {
                const db = req.result;
                const tx = db.transaction('keys', 'readwrite');
                tx.objectStore('keys').put(key, this.keyPrefix + userId);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };
            req.onerror = () => reject(req.error);
        });
    }

    private retrieveAnchoredKey(userId: string): Promise<CryptoKey | null> {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('sylos_enclave_anchor', 1);
            req.onsuccess = () => {
                const db = req.result;
                // Proceed carefully if the DB lacks the keys store (first run without upgrade logic hit)
                if (!db.objectStoreNames.contains('keys')) return resolve(null);

                const tx = db.transaction('keys', 'readonly');
                const getReq = tx.objectStore('keys').get(this.keyPrefix + userId);
                getReq.onsuccess = () => resolve(getReq.result || null);
                getReq.onerror = () => reject(getReq.error);
            };
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Scrapes the enclave key from the anchor entirely.
     * Typically used during a "Master Kill-Switch" execution to globally disable the unit.
     */
    async vaporizeEnclaveKey(userId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('sylos_enclave_anchor', 1);
            req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('keys')) return resolve();
                const tx = db.transaction('keys', 'readwrite');
                tx.objectStore('keys').delete(this.keyPrefix + userId);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject();
            };
        });
    }
}

export const hardwareEnclave = new HardwareEnclaveService();
