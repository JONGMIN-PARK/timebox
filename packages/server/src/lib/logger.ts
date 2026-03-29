type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatLevel(level: LogLevel): string {
    return level.toUpperCase().padEnd(5);
  }

  private formatContext(context?: LogContext): string {
    if (!context || Object.keys(context).length === 0) return "";
    try {
      return " " + JSON.stringify(context);
    } catch {
      return " [unserializable context]";
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = this.formatTimestamp();
    const lvl = this.formatLevel(level);
    const ctx = this.formatContext(context);
    const line = `[${timestamp}] [${lvl}] ${message}${ctx}`;

    switch (level) {
      case "error":
        console.error(line);
        break;
      case "warn":
        console.warn(line);
        break;
      case "debug":
        if (process.env.NODE_ENV !== "production") {
          console.debug(line);
        }
        break;
      default:
        console.log(line);
    }
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log("error", message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }
}

export const logger = new Logger();
