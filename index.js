import "dotenv/config";
import readline from "readline";
import bcrypt from "bcrypt";
import Fastify from "fastify";
import fs from "fs";
import path from "path";
import csv from "csv-parser";

import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { pool } from "./db.js";

const { APP_USER, APP_PASS_HASH, PORT = 3000 } = process.env;


if (!APP_USER || !APP_PASS_HASH) {
  console.log("\x1b[31m%s\x1b[0m", "❌ Missing APP_USER or APP_PASS_HASH in .env");
  process.exit(1);
}


const MAX_ATTEMPTS = 3;
let attempts = 0;

const fastify = Fastify({ logger: true });


function askPassword(query) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let password = "";

    stdout.write(query);

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const onData = (char) => {
      char = char.toString();

      if (char === "\r" || char === "\n") {
        stdout.write("\n");
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        resolve(password);
        return;
      }

      if (char === "\u0003") process.exit();

      if (char === "\u007f") {
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }

      password += char;
      stdout.write("*");
    };

    stdin.on("data", onData);
  });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));


async function login() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Username: ", async (username) => {
      rl.close();

      const password = await askPassword("Password: ");
      const userOk = username === APP_USER;
      const passOk = await bcrypt.compare(password, APP_PASS_HASH);

      if (userOk && passOk) {
        console.log("\x1b[32m%s\x1b[0m", "✅ Login success\n");
        resolve(true);
      } else {
        attempts++;
        console.log(
          "\x1b[31m%s\x1b[0m",
          `❌ Login failed (${attempts}/${MAX_ATTEMPTS})`
        );

        if (attempts >= MAX_ATTEMPTS) {
          console.log("🚫 Too many failed attempts. Exit.");
          process.exit(1);
        }

        const wait = attempts * 2000;
        console.log(`⏱ Wait ${wait / 1000}s...\n`);
        await delay(wait);
        resolve(await login());
      }
    });
  });
}


await fastify.register(swagger, {
  openapi: {
    info: {
      title: "CSV Production API",
      version: "1.0.0",
    },
  },
});

await fastify.register(swaggerUI, {
  routePrefix: "/docs",
});

function readLastRowCSV(filePath) {
  return new Promise((resolve, reject) => {
    let lastRow = null;

    fs.createReadStream(filePath)
      .pipe(csv({ headers: false }))
      .on("data", (row) => (lastRow = row))
      .on("end", () => {
        if (!lastRow) reject(new Error("CSV empty"));
        resolve(lastRow);
      })
      .on("error", reject);
  });
}

function getCurrentInfo() {
  const now = new Date();
  return {
    year: now.getFullYear().toString(),
    month: String(now.getMonth() + 1).padStart(2, "0"),
    day: String(now.getDate()).padStart(2, "0"),
  };
}


fastify.get("/api/trd", async () => {
  const { year, month, day } = getCurrentInfo();
  const filename = `Trd${year}${month}${day}.csv`;
  const filePath = path.join(process.cwd(), "data", year, month, filename);

  if (!fs.existsSync(filePath)) {
    return { error: "File not found", filename };
  }

  const row = await readLastRowCSV(filePath);

  const data = {
    file_used: filename,
    partnumber: row[1],
    shot_current_part: Number(row[6]),
    shot_ok: Number(row[7]),
    shot_ng: Number(row[8]),
    shot_total: Number(row[9]),
    ct: Number(row[10]),
    timestamp: row[38],
  };

  await pool.query(
    `
    INSERT INTO trd_production
    (partnumber, shot_current_part, shot_ok, shot_ng, shot_total, ct, timestamp, file_used)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (timestamp) DO NOTHING
    `,
    Object.values(data)
  );

  return data;
});


fastify.get("/api/sts", async () => {
  const { year, month } = getCurrentInfo();
  const filename = `Sts${year}${month}.csv`;
  const filePath = path.join(process.cwd(), "data", year, month, filename);

  if (!fs.existsSync(filePath)) {
    return { error: "File not found", filename };
  }

  const row = await readLastRowCSV(filePath);

  const data = {
    timestamp: row[1],
    status: Number(row[2]),
    partnumber: row[3],
    file_used: filename,
  };

  await pool.query(
    `
    INSERT INTO sts_status
    (timestamp, status, partnumber, file_used)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (timestamp) DO NOTHING
    `,
    Object.values(data)
  );

  return data;
});

console.log("\x1b[36m%s\x1b[0m", "🔐 Secure Login Required");
console.log(`❗ Max attempts: ${MAX_ATTEMPTS}\n`);

await login();

await fastify.listen({ port: PORT, host: "0.0.0.0" });
console.log("🚀 http://localhost:" + PORT);
console.log("📘 http://localhost:" + PORT + "/docs");
