import { mkdir, writeFile, chmod } from "fs/promises";
import { createWriteStream } from "fs";
import https from "https";
import { exec } from "child_process";
import unzipper from "unzipper";

const RHUBARB_URL =
  "https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.13.0/rhubarb-lip-sync-1.13.0-linux.zip";
const BIN_DIR = "./bin";
const ZIP_PATH = `${BIN_DIR}/rhubarb.zip`;

async function downloadFile(url, path) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(path);
    https.get(url, (response) => {
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (err) => {
      reject(err);
    });
  });
}

async function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const stream = unzipper.Extract({ path: destDir });
    stream.on("close", resolve);
    stream.on("error", reject);
    createReadStream(zipPath).pipe(stream);
  });
}

async function installRhubarb() {
  try {
    console.log("Creating bin directory...");
    await mkdir(BIN_DIR, { recursive: true });

    console.log("Downloading rhubarb...");
    await downloadFile(RHUBARB_URL, ZIP_PATH);

    console.log("Extracting rhubarb...");
    await extractZip(ZIP_PATH, BIN_DIR);

    console.log("Setting executable permissions...");
    await chmod(`${BIN_DIR}/rhubarb`, 0o755);

    console.log("Rhubarb installed successfully.");
  } catch (err) {
    console.error("Failed to install rhubarb:", err);
    process.exit(1);
  }
}

installRhubarb();
