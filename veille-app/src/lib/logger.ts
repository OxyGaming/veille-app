/**
 * Logger structuré minimal — sortie JSON-line.
 *
 * Format :
 *   { "ts": "...", "level": "info|warn|error|debug", "msg": "...", ... }
 *
 * Règles de confidentialité (US-1.10) :
 *  - **NE JAMAIS** logger un mot de passe, un cookie d'auth, un token, ou un
 *    hash de mot de passe.
 *  - Ne pas logger d'email/userId/IP sauf si le contexte le justifie
 *    explicitement (auth, sécurité). Préférer un id technique opaque sinon.
 *  - Le caller est responsable du filtrage des données sensibles avant appel.
 *
 * Cf. AUDIT.md §MT-09 / BACKLOG-V2.md US-1.10.
 */

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

function emit(level: LogLevel, msg: string, ctx?: LogContext): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(ctx ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (level === "debug") {
    // Debug uniquement si LOG_LEVEL=debug en env.
    if (process.env.LOG_LEVEL === "debug") console.debug(line);
  } else {
    console.log(line);
  }
}

export const log = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
};
