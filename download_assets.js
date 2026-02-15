import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const themesDir = path.join(__dirname, "client", "public", "assets", "themes");

if (!fs.existsSync(themesDir)) {
    fs.mkdirSync(themesDir, { recursive: true });
}

const files = [
    { name: "naruto.gif", url: "https://media.giphy.com/media/Nzz86dByLtYTS/giphy.gif" },
    { name: "dragonball.gif", url: "https://media.giphy.com/media/8QtP5TqscKh3O/giphy.gif" },
    { name: "sololeveling.gif", url: "https://media.giphy.com/media/7wZhANge7PYu4576eC/giphy.gif" },
    { name: "hxh.gif", url: "https://media.giphy.com/media/u4dQ8BMugUYp2/giphy.gif" },
    { name: "lotr.gif", url: "https://media.giphy.com/media/TcdpZwYDPlWXC/giphy.gif" },
];

function fetchWithRedirects(url, redirectsLeft = 5) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (response) => {
            const statusCode = response.statusCode ?? 0;

            if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
                response.resume();
                if (redirectsLeft <= 0) {
                    reject(new Error(`Too many redirects for ${url}`));
                    return;
                }
                const nextUrl = new URL(response.headers.location, url).toString();
                resolve(fetchWithRedirects(nextUrl, redirectsLeft - 1));
                return;
            }

            if (statusCode !== 200) {
                response.resume();
                reject(new Error(`Unexpected status ${statusCode} for ${url}`));
                return;
            }

            resolve(response);
        });

        req.on("error", reject);
    });
}

async function downloadFile(file) {
    const filePath = path.join(themesDir, file.name);
    const tempPath = `${filePath}.tmp`;
    const response = await fetchWithRedirects(file.url);

    await new Promise((resolve, reject) => {
        let settled = false;
        const fileStream = fs.createWriteStream(tempPath);

        const fail = (error) => {
            if (settled) return;
            settled = true;
            fileStream.destroy();
            response.destroy();
            fs.rm(tempPath, { force: true }, () => reject(error));
        };

        response.on("error", fail);
        fileStream.on("error", fail);
        fileStream.on("finish", () => {
            if (settled) return;
            settled = true;
            resolve();
        });

        response.pipe(fileStream);
    });

    fs.renameSync(tempPath, filePath);
    const bytes = fs.statSync(filePath).size;
    console.log(`Downloaded ${file.name} (${bytes} bytes)`);
}

async function main() {
    let failures = 0;

    for (const file of files) {
        try {
            await downloadFile(file);
        } catch (error) {
            failures += 1;
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Error downloading ${file.name}: ${message}`);
        }
    }

    if (failures > 0) {
        console.error(`Completed with ${failures} failure(s).`);
        process.exitCode = 1;
        return;
    }

    console.log("All theme GIFs downloaded successfully.");
}

void main();
