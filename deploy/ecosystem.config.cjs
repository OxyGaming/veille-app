/**
 * Configuration PM2 — alternative au démarrage en CLI.
 *
 * Usage :
 *   pm2 start deploy/ecosystem.config.cjs
 *
 * Variables ENV qu'on relit (avec fallbacks) :
 *   PORT, NODE_ENV
 *
 * Note : on lance `npm start` depuis le sous-dossier veille-app/, car
 * c'est là que se trouve le package.json applicatif.
 */
module.exports = {
  apps: [
    {
      name: "veille",
      cwd: __dirname + "/../veille-app",
      script: "npm",
      args: "start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3004",
      },
      // Logs concaténés ; PM2 tourne au quotidien.
      out_file: "/var/log/pm2/veille.out.log",
      error_file: "/var/log/pm2/veille.err.log",
      merge_logs: true,
      time: true,
    },
  ],
};
