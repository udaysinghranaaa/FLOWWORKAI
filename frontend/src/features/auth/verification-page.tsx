import { useState } from 'react'
import { Link } from 'react-router'
import { Brand } from '@/components/layout/app-shell'
import { Badge, Card } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/fields'
import { api } from '@/services/api-client'
import { useActionToken } from './use-action-token'

export default function VerificationPage() {
  const token = useActionToken()
  const [email, setEmail] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  async function verify() {
    setBusy(true)
    try {
      await api.verify(token)
      setNotice('Email verified. You can now sign in.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not verify this link.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="onboarding-page">
      <Brand />
      <Card>
        <Badge tone="violet">EMAIL VERIFICATION</Badge>
        <h1>A small step toward a shared workspace.</h1>
        <p className="muted">
          Confirm your address before signing in. Opening this page alone does not consume a link.
        </p>
        {token ? (
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              void verify()
            }}
          >
            Verify email
          </Button>
        ) : (
          <p>Open the one-time link from your verification message.</p>
        )}
        <form
          className="form-stack"
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            try {
              const result = await api.resend(email)
              setNotice(
                result.deliveryMode === 'development-capture'
                  ? 'If eligible, instructions are in the local development mail capture. No email delivery is claimed.'
                  : 'If eligible, check your email for verification instructions.',
              )
            } catch (error) {
              setNotice(error instanceof Error ? error.message : 'Could not request verification.')
            } finally {
              setBusy(false)
            }
          }}
        >
          <Field id="verify-email" label="Email address">
            <Input
              id="verify-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </Field>
          <Button type="submit" disabled={busy}>
            Resend verification
          </Button>
        </form>
        {notice && <p role="status">{notice}</p>}
        <Button asChild>
          <Link to="/login">Back to login</Link>
        </Button>
      </Card>
      <Link to="/w/studio/dashboard">Explore Demo Workspace</Link>
    </main>
  )
}
