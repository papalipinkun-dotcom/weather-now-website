import { spawn } from 'node:child_process';
import net from 'node:net';

const DEFAULT_WEB_PORT = 5173;
const DEFAULT_API_PORT = 8080;

function isValidPort(value, fallback) {
  const port = Number(value ?? fallback);
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1));
        return;
      }

      reject(error);
    });

    server.listen(startPort, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : startPort;

      server.close(() => resolve(port));
    });
  });
}

async function resolvePort(rawPort, defaultPort) {
  const preferredPort = rawPort && isValidPort(rawPort, defaultPort) ? Number(rawPort) : defaultPort;
  return findAvailablePort(preferredPort);
}

async function main() {
  const isApiOnly = process.argv.includes('--api-only');
  const isWebOnly = process.argv.includes('--web-only');

  const webPort = await resolvePort(process.env.WEB_PORT, DEFAULT_WEB_PORT);
  const apiPort = await resolvePort(process.env.API_PORT, DEFAULT_API_PORT);

  const env = {
    ...process.env,
    WEB_PORT: String(webPort),
    API_PORT: String(apiPort),
    PORT: String(apiPort),
  };

  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const targetArgs = isApiOnly
    ? ['--filter', '@workspace/api-server', 'run', 'dev']
    : isWebOnly
      ? ['--filter', '@workspace/web-app', 'run', 'dev']
      : ['--parallel', '--filter', '@workspace/api-server', '--filter', '@workspace/web-app', 'run', 'dev'];

  const child = spawn(command, targetArgs, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
