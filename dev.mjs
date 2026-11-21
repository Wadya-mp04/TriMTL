// One command for local dev: server + Cloudflare tunnel + Expo, wired together.
// shortcut: quick tunnel URL changes every run; drop the tunnel once the server is deployed.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const server = spawn('npm', ['run', 'dev'], { cwd: 'server', stdio: ['ignore', 'inherit', 'inherit'] });
const tunnel = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--url', 'http://localhost:3001'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

let expo, url;
const onTunnelOutput = async (buf) => {
  if (url) return;
  url = buf.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (!url) return;
  // A new quick tunnel takes a few seconds to resolve; start Expo only once the server answers through it.
  console.log(`\n› Waiting for server tunnel ${url} ...`);
  for (let i = 0; i < 60; i++) {
    if (await fetch(`${url}/health`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`› Server reachable. Writing it to mobile/.env.local\n`);
  writeFileSync('mobile/.env.local', `# Written by npm run dev. Server URL only, never the Gemini key.\nEXPO_PUBLIC_API_URL=${url}\n`);
  // -c because Expo inlines EXPO_PUBLIC_* into the bundle.
  expo = spawn('npx', ['expo', 'start', '--tunnel', '-c'], { cwd: 'mobile', stdio: 'inherit' });
  expo.on('exit', stop);
};
tunnel.stdout.on('data', onTunnelOutput);
tunnel.stderr.on('data', onTunnelOutput);

function stop() {
  for (const p of [server, tunnel, expo]) p?.kill();
  process.exit();
}
process.on('SIGINT', stop);
server.on('exit', stop);
tunnel.on('exit', stop);
