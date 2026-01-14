import pkg from 'pg'
const { Pool } = pkg

export const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '11110000',
  database: 'postgres'
})
