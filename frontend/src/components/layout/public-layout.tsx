import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Menu, ArrowUpRight, Moon, Sun } from 'lucide-react'
import { Brand } from './app-shell'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlays'
import { useUIStore } from '@/stores/ui-store'

export default function PublicLayout() {
  const [open, setOpen] = useState(false)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const nav = (
    <>
      <NavLink to="/features" onClick={() => setOpen(false)}>
        Product
      </NavLink>
      <NavLink to="/pricing" onClick={() => setOpen(false)}>
        Pricing
      </NavLink>
      <a href="/#workflow" onClick={() => setOpen(false)}>
        For agencies
      </a>
    </>
  )
  return (
    <div className="public-site">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="public-header">
        <Brand />
        <nav aria-label="Public navigation" className="public-desktop-nav">
          {nav}
        </nav>
        <div className="public-header-actions">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle public site theme"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </Button>
          <Link className="public-login" to="/login">
            Log in
          </Link>
          <Button asChild variant="primary">
            <Link to="/w/studio/dashboard">
              Explore demo
              <ArrowUpRight size={15} />
            </Link>
          </Button>
          <Button
            className="mobile-only"
            size="icon"
            aria-label="Open site menu"
            onClick={() => setOpen(true)}
          >
            <Menu size={18} />
          </Button>
        </div>
      </header>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Explore FlowWork AI"
        description="Product information and the frontend demo."
      >
        <nav className="public-mobile-nav">
          {nav}
          <Link to="/login" onClick={() => setOpen(false)}>
            Log in
          </Link>
          <Link to="/signup" onClick={() => setOpen(false)}>
            Signup preview
          </Link>
        </nav>
      </Sheet>
      <main id="main-content">
        <Outlet />
      </main>
      <footer className="public-footer">
        <div>
          <Brand />
          <p>
            One Workspace. Every Workflow.
            <br />
            Powered by AI.
          </p>
          <small>Frontend demonstration. No live services.</small>
        </div>
        <div>
          <h3>Product</h3>
          <Link to="/features">Features</Link>
          <Link to="/pricing">Illustrative pricing</Link>
          <Link to="/w/studio/dashboard">Explore workspace</Link>
        </div>
        <div>
          <h3>Explore</h3>
          <Link to="/w/studio/portal/dashboard">Client portal preview</Link>
          <Link to="/w/studio/ai">FlowAI preview</Link>
          <Link to="/login">Account UI</Link>
        </div>
        <div className="footer-note">
          <span>Built with care, for the work ahead.</span>
          <small>© 2026 FlowWork AI. A product in development.</small>
        </div>
      </footer>
    </div>
  )
}
