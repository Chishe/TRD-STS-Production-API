CREATE TABLE trd_production (
  id SERIAL PRIMARY KEY,
  partnumber VARCHAR(50),
  shot_current_part INTEGER,
  shot_ok INTEGER,
  shot_ng INTEGER,
  shot_total INTEGER,
  ct NUMERIC(10,2),
  timestamp TIMESTAMP,
  file_used VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(timestamp)
);

CREATE TABLE sts_status (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP,
  status INTEGER,
  partnumber VARCHAR(50),
  file_used VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(timestamp)
);
