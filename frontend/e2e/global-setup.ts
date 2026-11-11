import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export default function globalSetup() {
  const result =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm.cmd run test:prepare'], {
          cwd: fileURLToPath(new URL('../../backend', import.meta.url)),
          stdio: 'inherit',
          windowsHide: true,
        })
      : spawnSync('npm', ['run', 'test:prepare'], {
          cwd: fileURLToPath(new URL('../../backend', import.meta.url)),
          stdio: 'inherit',
        })
  if (result.status !== 0)
    throw new Error('Backend build must pass before full-stack browser tests.')
}
