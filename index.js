import Fastify from 'fastify'
import fs from 'fs'
import path from 'path'
import csv from 'csv-parser'

import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'

const fastify = Fastify({ logger: true })

/* ======================================================
   SWAGGER SETUP
====================================================== */
await fastify.register(swagger, {
  openapi: {
    info: {
      title: 'CSV Production API',
      description: `
API สำหรับอ่านข้อมูลจากไฟล์ CSV

TRD
- อ่านไฟล์ตามวันปัจจุบันเท่านั้น
- TrdYYYYMMDD.csv
- ถ้าไฟล์ไม่มี → 404

STS
- อ่านไฟล์ตามเดือนปัจจุบัน
- StsYYYYMM.csv
`,
      version: '1.0.0'
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local / LAN' }
    ],
    tags: [
      { name: 'TRD', description: 'Production daily data' },
      { name: 'STS', description: 'Machine status monthly data' }
    ]
  }
})


await fastify.register(swaggerUI, {
  routePrefix: '/docs'
})

/* ======================================================
   READ LAST ROW FROM CSV
====================================================== */
function readLastRowCSV(filePath) {
  return new Promise((resolve, reject) => {
    let lastRow = null

    fs.createReadStream(filePath)
      .pipe(csv({ headers: false }))
      .on('data', row => {
        lastRow = row
      })
      .on('end', () => {
        if (!lastRow) {
          return reject(new Error('CSV is empty'))
        }
        resolve(lastRow)
      })
      .on('error', err => reject(err))
  })
}

/* ======================================================
   CURRENT DATE
====================================================== */
function getCurrentInfo() {
  const now = new Date()
  return {
    year: now.getFullYear().toString(),
    month: String(now.getMonth() + 1).padStart(2, '0'),
    day: String(now.getDate()).padStart(2, '0')
  }
}

/* ======================================================
   API : TRD (CURRENT DAY ONLY)
====================================================== */
fastify.get('/api/trd', {
  schema: {
    tags: ['TRD'],
    summary: 'Get TRD data (current date only)',
    response: {
      200: {
        type: 'object',
        properties: {
          file_used: { type: 'string', example: 'Trd20260113.csv' },
          partnumber: { type: 'string' },
          shot_current_part: { type: 'number' },
          shot_ok: { type: 'number' },
          shot_ng: { type: 'number' },
          shot_total: { type: 'number' },
          ct: { type: 'number' },
          timestamp: { type: 'string' }
        }
      },
      404: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          expected_file: { type: 'string' },
          path: { type: 'string' }
        }
      }
    }
  }
}, async (req, reply) => {
  try {
    const { year, month, day } = getCurrentInfo()

    const filename = `Trd${year}${month}${day}.csv`
    const filePath = path.join(
      process.cwd(),
      'data',
      year,
      month,
      filename
    )

    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({
        error: 'TRD file for current date not found',
        expected_file: filename,
        path: filePath
      })
    }

    const row = await readLastRowCSV(filePath)

    return {
      file_used: filename,
      partnumber: row[1],                // B
      shot_current_part: Number(row[6]), // G
      shot_ok: Number(row[7]),           // H
      shot_ng: Number(row[8]),           // I
      shot_total: Number(row[9]),        // J
      ct: Number(row[10]),               // K
      timestamp: row[38]                 // AM
    }

  } catch (err) {
    return reply.code(500).send({ error: err.message })
  }
})

/* ======================================================
   API : STS (CURRENT MONTH ONLY)
====================================================== */
fastify.get('/api/sts', {
  schema: {
    tags: ['STS'],
    summary: 'Get STS data (current month)',
    response: {
      200: {
        type: 'object',
        properties: {
          file_used: { type: 'string', example: 'Sts202601.csv' },
          timestamp: { type: 'string' },
          status: { type: 'number' },
          partnumber: { type: 'string' }
        }
      },
      404: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          expected_file: { type: 'string' },
          path: { type: 'string' }
        }
      }
    }
  }
}, async (req, reply) => {
  try {
    const { year, month } = getCurrentInfo()

    const filename = `Sts${year}${month}.csv`
    const filePath = path.join(
      process.cwd(),
      'data',
      year,
      month,
      filename
    )

    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({
        error: 'STS file for current month not found',
        expected_file: filename,
        path: filePath
      })
    }

    const row = await readLastRowCSV(filePath)

    return {
      file_used: filename,
      timestamp: row[1],      // B
      status: Number(row[2]), // C
      partnumber: row[3]      // D
    }

  } catch (err) {
    return reply.code(500).send({ error: err.message })
  }
})

/* ======================================================
   START SERVER
====================================================== */
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log('🚀 API running at http://localhost:3000')
    console.log('📘 Swagger UI at http://localhost:3000/docs')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
