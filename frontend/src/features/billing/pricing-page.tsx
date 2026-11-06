import { useState } from 'react'
import { Link } from 'react-router'
import { Check, ArrowUpRight } from 'lucide-react'
import { plans } from './plans'
import { Button } from '@/components/ui/button'
import { Card, Badge, Table } from '@/components/ui/display'
import { Switch } from '@/components/ui/fields'

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)
  return (
    <>
      <section className="public-section pricing-intro">
        <Badge tone="violet">ILLUSTRATIVE PRICING</Badge>
        <h1>
          Good work deserves
          <br />
          room to grow.
        </h1>
        <p className="hero-subtitle">
          Explore a simple plan structure for a future agency workspace.
          <br />
          These example prices are not an offer for sale.
        </p>
        <Switch label="Annual example · 20% less" checked={annual} onCheckedChange={setAnnual} />
        <div className="pricing-grid">
          {plans.map((p) => (
            <Card
              className={`pricing-card ${p.name === 'Growth' ? 'featured-plan' : ''}`}
              key={p.name}
            >
              {p.name === 'Growth' && <span className="plan-tag">FEATURED EXAMPLE</span>}
              <h2>{p.name}</h2>
              <p className="muted">{p.description}</p>
              <p className="plan-price">
                ${annual ? (p.monthly * 0.8).toFixed(2) : p.monthly}
                <span>/ month</span>
              </p>
              <small>
                {annual
                  ? `$${(p.monthly * 0.8 * 12).toFixed(2)} USD/year example`
                  : 'USD · illustrative pricing'}
              </small>
              <Button
                asChild
                variant={p.name === 'Growth' ? 'primary' : 'secondary'}
                className="w-full"
              >
                <Link to={`/signup?plan=${p.name.toLowerCase()}`}>
                  Explore {p.name}
                  <ArrowUpRight size={15} />
                </Link>
              </Button>
              <ul>
                {[`${p.seats} internal seats`, `${p.storage} example storage`, ...p.features].map(
                  (f) => (
                    <li key={f}>
                      <Check size={15} />
                      {f}
                    </li>
                  ),
                )}
              </ul>
            </Card>
          ))}
        </div>
      </section>
      <section className="public-section">
        <div className="section-intro">
          <p className="eyebrow">THE DETAILS, IN THE OPEN</p>
          <h2>A little clarity before you choose.</h2>
          <p>
            No payment processing, paid subscription, or real entitlement is active in this preview.
          </p>
        </div>
        <div className="card table-card">
          <Table
            rows={plans.map((p) => ({ ...p }))}
            getKey={(p) => p.name}
            caption="Illustrative plan comparison"
            columns={[
              { label: 'Plan', render: (p) => p.name },
              { label: 'Internal seats', render: (p) => p.seats },
              { label: 'Storage example', render: (p) => p.storage },
              { label: 'AI usage example', render: (p) => p.ai },
            ]}
          />
        </div>
        <div className="pricing-faq">
          <h3>Can I buy a plan today?</h3>
          <p>
            This is a frontend demonstration. Pricing is illustrative; checkout and payment
            collection are unavailable.
          </p>
          <h3>What can I try?</h3>
          <p>
            Create demo projects and tasks, move cards, explore the client portal, and browse
            scripted AI examples. All domain changes reset on refresh.
          </p>
          <Button asChild variant="primary">
            <Link to="/w/studio/dashboard">
              Explore Demo Workspace
              <ArrowUpRight size={15} />
            </Link>
          </Button>
        </div>
      </section>
    </>
  )
}
