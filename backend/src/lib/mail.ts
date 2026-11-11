import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import nodemailer from 'nodemailer'
import type { AuthConfig } from '../config/auth-env.js'

export interface AuthMail {
  to: string
  purpose: 'verify-email' | 'reset-password'
  link: string
}
export interface MailAdapter {
  send: (message: AuthMail) => Promise<void>
  close?: () => void
}

export function createMailAdapter(
  config: AuthConfig,
  captureDirectory = '.mail-capture',
): MailAdapter {
  if (config.mailMode === 'capture') {
    if (config.secureCookies) throw new Error('Mail capture is forbidden in production.')
    return {
      send: async (message) => {
        await mkdir(captureDirectory, { recursive: true, mode: 0o700 })
        await writeFile(join(captureDirectory, `${randomUUID()}.json`), JSON.stringify(message), {
          mode: 0o600,
          flag: 'wx',
        })
      },
    }
  }
  if (!config.smtp) throw new Error('SMTP configuration missing.')
  const smtp = config.smtp
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    requireTLS: true,
    auth: { user: smtp.user, pass: smtp.password },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    logger: false,
    debug: false,
  })
  return {
    send: async (message) => {
      const info = await transport.sendMail({
        from: smtp.from,
        to: message.to,
        subject:
          message.purpose === 'verify-email'
            ? 'Verify your FlowWork AI email'
            : 'Reset your FlowWork AI password',
        text: `Open this one-time link to ${message.purpose}:\n${message.link}\nIf you did not request this, ignore this message.`,
      })
      if (!info.accepted.length) throw new Error('Mail provider did not accept the message.')
    },
    close: () => transport.close(),
  }
}
