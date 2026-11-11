/** Test-only orchestrator. Never loads .env or accepts an external database URI. */
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { randomBytes, randomUUID } from 'node:crypto'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { assertSafeTestDatabase } from '../tests/test-database-safety.js'

let repl: MongoMemoryReplSet | undefined
let child: ChildProcess | undefined
let stopping = false
async function stop(code = 0) {
  if (stopping) return
  stopping = true
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit')
    child.kill()
    await exited
  }
  await repl?.stop()
  process.exit(code)
}
process.on('message', (message) => {
  if (message === 'stop') void stop()
})
process.on('SIGINT', () => {
  void stop()
})
process.on('SIGTERM', () => {
  void stop()
})

async function main() {
  repl = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 60000 }],
  })
  const name = `flowwork_test_e2e_${randomUUID().replaceAll('-', '')}`
  const uri = repl.getUri(name)
  assertSafeTestDatabase(uri, 'test', name)
  child = spawn(process.execPath, ['dist/server.js'], {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: '5081',
      FRONTEND_ORIGIN: 'http://127.0.0.1:4173',
      MONGODB_URI: uri,
      JWT_SECRET: randomBytes(32).toString('hex'),
      MAIL_MODE: 'capture',
      LOG_LEVEL: 'info',
    },
  })
  let ownListenerReady = false,
    output = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString()
    const lines = output.split('\n')
    output = lines.pop() ?? ''
    for (const line of lines) {
      try {
        if ((JSON.parse(line) as { msg?: string }).msg === 'HTTP server listening')
          ownListenerReady = true
      } catch {
        /* Only inspect this child's structured startup marker. */
      }
    }
  })
  child.stderr?.resume()
  child.once('error', () => {
    void stop(1)
  })
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Compiled test backend exited before readiness.')
    try {
      const response = await fetch('http://127.0.0.1:5081/api/v1/health/ready', {
        signal: AbortSignal.timeout(500),
      })
      if (ownListenerReady && response.status === 200) {
        process.send?.('ready')
        return
      }
    } catch {
      /* Await this test's listener, never another database. */
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('Compiled test backend readiness deadline exceeded.')
}
void main().catch(() => {
  console.error('Isolated authentication test server failed; no Atlas URI was loaded.')
  void stop(1)
})
