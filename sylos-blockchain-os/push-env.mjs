import * as fs from 'fs';
import * as cp from 'child_process';

const envFile = fs.readFileSync('.env', 'utf-8');
const lines = envFile.split('\n');

for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();

    if (key && value) {
        console.log(`Adding ${key} to Vercel...`);
        try {
            for (const env of ['production', 'preview', 'development']) {
                cp.execSync(`npx vercel env add ${key} ${env} --scope team_hAbMHKyE95ouR5oKSq0BIjpe`, {
                    input: value,
                    stdio: ['pipe', 'inherit', 'inherit']
                });
            }
            console.log(`✅ ${key} added successfully.`);
        } catch (err) {
            console.error(`❌ Failed to add ${key}`);
        }
    }
}
