module.exports = {
  apps: [
    {
      name: 'prod-csv-api',
      script: 'index.js',

      // 🔹 โหมดการทำงาน
      exec_mode: 'fork',        // API + file IO → fork เหมาะสุด
      instances: 1,             // เปลี่ยนเป็น 'max' ได้ถ้าต้องการ cluster

      // 🔹 Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },

      // 🔹 Auto restart
      autorestart: true,
      watch: false,             // ปิด watch ใน production
      max_memory_restart: '300M',

      // 🔹 Logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,

      // 🔹 Graceful shutdown
      kill_timeout: 3000,

      // 🔹 Windows compatibility
      windowsHide: true
    }
  ]
}
