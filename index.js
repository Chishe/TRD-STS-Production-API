import Fastify from "fastify";
import fs from "fs";
import path from "path";
import csv from "csv-parser";

import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { pool } from "./db.js";

const fastify = Fastify({ logger: true });

/* ======================================================
   SWAGGER
====================================================== */
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

/* ======================================================
   UTILS
====================================================== */
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

/* ======================================================
   API : TRD
====================================================== */
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
    partnumber: row[1],                 // B
    shot_current_part: Number(row[6]),  // G
    shot_ok: Number(row[7]),            // H
    shot_ng: Number(row[8]),            // I
    shot_total: Number(row[9]),         // J
    ct: Number(row[10]),                // K
    timestamp: row[38],                 // AM
  };

  await pool.query(
    `
    INSERT INTO trd_production
    (partnumber, shot_current_part, shot_ok, shot_ng, shot_total, ct, timestamp, file_used)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (timestamp) DO NOTHING
    `,
    [
      data.partnumber,
      data.shot_current_part,
      data.shot_ok,
      data.shot_ng,
      data.shot_total,
      data.ct,
      data.timestamp,
      data.file_used,
    ]
  );

  return data;
});

/* ======================================================
   API : STS
====================================================== */
fastify.get("/api/sts", async () => {
  const { year, month } = getCurrentInfo();
  const filename = `Sts${year}${month}.csv`;
  const filePath = path.join(process.cwd(), "data", year, month, filename);

  if (!fs.existsSync(filePath)) {
    return { error: "File not found", filename };
  }

  const row = await readLastRowCSV(filePath);

  const data = {
    file_used: filename,
    timestamp: row[1],      //B
    status: Number(row[2]), //C
    partnumber: row[3],     //D
  };

  await pool.query(
    `
    INSERT INTO sts_status
    (timestamp, status, partnumber, file_used)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (timestamp) DO NOTHING
    `,
    [data.timestamp, data.status, data.partnumber, data.file_used]
  );

  return data;
});

/* ======================================================
   START SERVER
====================================================== */
const start = async () => {
  await fastify.listen({ port: 3000, host: "0.0.0.0" });
  console.log("🚀 http://localhost:3000");
  console.log("📘 http://localhost:3000/docs");
};

start();
