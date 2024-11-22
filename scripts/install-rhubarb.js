import { mkdir, chmod, readdir } from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import https from "https";
import unzipper from "unzipper";
import path from "path";

const RHUBARB_URL =
  "https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.13.0/rhubarb-lip-sync-1.13.0-linux.zip";
const BIN_DIR = "./bin";
const ZIP_PATH = `${BIN_DIR}/rhubarb.zip`;

async function downloadFile(url, path) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(path);
    function handleResponse(response) {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", reject);
      } else if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        // Follow redirect
        const redirectUrl = new URL(response.headers.location, url).toString();
        https.get(redirectUrl, handleResponse).on("error", reject);
      } else {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
      }
    }

    https.get(url, handleResponse).on("error", reject);
  });
}

async function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const stream = unzipper.Extract({ path: destDir });
    stream.on("close", resolve);
    stream.on("error", reject);
    createReadStream(zipPath).pipe(stream).on("error", reject);
  });
}

async function findRhubarbBin(dir) {
  const files = await readdir(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === "rhubarb") {
      return fullPath; // Return the full path to the binary
    }
  }
  throw new Error("Rhubarb binary not found after extraction");
}

async function installRhubarb() {
  try {
    console.log("Creating bin directory...");
    await mkdir(BIN_DIR, { recursive: true });

    console.log("Downloading rhubarb...");
    await downloadFile(RHUBARB_URL, ZIP_PATH);

    console.log("Extracting rhubarb...");
    await extractZip(ZIP_PATH, BIN_DIR);

    console.log("Locating rhubarb binary...");
    const rhubarbPath = await findRhubarbBin(BIN_DIR);

    console.log("Setting executable permissions...");
    await chmod(rhubarbPath, 0o755);

    console.log("Rhubarb installed successfully at", rhubarbPath);
  } catch (err) {
    console.error("Failed to install rhubarb:", err.message);
    process.exit(1);
  }
}

installRhubarb();
