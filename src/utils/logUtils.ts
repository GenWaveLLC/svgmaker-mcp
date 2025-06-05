import fs from 'fs';
import path from 'path';
import os from 'os';

// Determine log directory based on platform
function getLogDirectory(): string {
  const appName = 'svgmaker-mcp';

  switch (process.platform) {
    case 'win32':
      return path.join(os.homedir(), 'AppData', 'Local', appName, 'logs');
    case 'darwin':
    case 'linux':
      return path.join(os.homedir(), '.cache', appName, 'logs');
    default:
      // Fallback to project logs directory
      return path.join(process.cwd(), 'logs');
  }
}

// Initialize logging configuration
const LOG_DIR = getLogDirectory();
const SESSION_START = new Date();
const LOG_FILE = path.join(
  LOG_DIR,
  `mcp-debug-${SESSION_START.toISOString().replace(/[:.]/g, '-')}.log`
);

// Check if debug logging is enabled
const DEBUG_ENABLED =
  process.env.SVGMAKER_DEBUG === 'true' || process.env.NODE_ENV === 'development';

// Ensure log directory exists
if (DEBUG_ENABLED) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// File logging utility (since console.log interferes with stdio transport)
export function logToFile(message: string): void {
  if (!DEBUG_ENABLED) return;

  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logEntry);
}

// Log session start
export function logSessionStart(): void {
  if (DEBUG_ENABLED) {
    logToFile('='.repeat(60));
    logToFile(`SVGMaker MCP Server starting - Session: ${SESSION_START.toISOString()}`);
    logToFile(`Log file: ${LOG_FILE}`);
    logToFile(`Debug mode: ${DEBUG_ENABLED ? 'ENABLED' : 'DISABLED'}`);
    logToFile('='.repeat(60));
  }
}

// Log session end
export function logSessionEnd(): void {
  if (DEBUG_ENABLED) {
    const sessionEnd = new Date();
    const duration = sessionEnd.getTime() - SESSION_START.getTime();
    logToFile('='.repeat(60));
    logToFile(`SVGMaker MCP Server shutting down - Session ended: ${sessionEnd.toISOString()}`);
    logToFile(`Session duration: ${Math.round(duration / 1000)}s`);
    logToFile('='.repeat(60));
  }
}

// Log fatal errors
export function logFatalError(error: Error): void {
  if (DEBUG_ENABLED) {
    logToFile(`FATAL ERROR: ${error.message}`);
    logToFile(`Stack trace: ${error.stack}`);
  }
}

// Export constants for external use
export { DEBUG_ENABLED, LOG_FILE, SESSION_START };
