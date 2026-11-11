import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Brand } from '@/components/layout/app-shell'
import { Badge, Card } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { useSession, useSignOut } from './use-session'

export default function AccountPage() {
  const { data: user } = useSession()
  const signOut = useSignOut(),
    navigate = useNavigate()
  const [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  async function logout(all: boolean) {
    setBusy(true)
    setNotice('')
    try {
      await signOut(all)
      navigate('/login', { replace: true })
    } catch {
      setNotice('Could not confirm sign out. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }
  if (!user) return null
  return (
    <main className="onboarding-page">
      <Brand />
      <Card>
        <Badge tone="green">REAL AUTHENTICATED ACCOUNT</Badge>
        <h1>Welcome, {user.name}.</h1>
        <p>{user.email}</p>
        <p className="muted">Email verified · {user.accountStatus} account</p>
        <h2>Your workspace comes next.</h2>
        <p className="muted">
          You have a real account. Company setup and workspace membership arrive in Phase 5; no
          workspace or subscription has been created.
        </p>
        <Button asChild variant="primary">
          <Link to="/w/studio/dashboard">Explore Demo Workspace</Link>
        </Button>
        <p className="muted">
          The demo uses fictional identities and in-memory records. It does not authorize backend
          access.
        </p>
        <Button
          disabled={busy}
          onClick={() => {
            void logout(false)
          }}
        >
          Sign out
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            void logout(true)
          }}
        >
          Sign out all devices
        </Button>
        {notice && <p role="alert">{notice}</p>}
      </Card>
      <Link to="/">Back to website</Link>
    </main>
  )
}
