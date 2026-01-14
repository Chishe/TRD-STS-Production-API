WITH
q AS (
  SELECT
    SUM(shot_ok)::float / NULLIF(SUM(shot_total),0) AS quality,
    SUM(shot_total) AS total_shot,
    AVG(ct) AS ct
  FROM trd_production
  WHERE timestamp::date = CURRENT_DATE
),
a AS (
  SELECT
    COUNT(*) AS run_min
  FROM sts_status
  WHERE status = 1
  AND timestamp::date = CURRENT_DATE
)
SELECT
  -- Availability
  a.run_min / 480.0 AS availability,

  -- Performance
  (q.ct * q.total_shot) / (a.run_min * 60.0) AS performance,

  -- Quality
  q.quality AS quality,

  -- OEE
  (a.run_min / 480.0)
  * ((q.ct * q.total_shot) / (a.run_min * 60.0))
  * q.quality AS oee

FROM q, a;
