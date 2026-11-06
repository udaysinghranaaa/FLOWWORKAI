import { useState } from 'react'
import { Check, CreditCard, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { useDemo } from '@/hooks/use-demo'
import { PageHeader, SectionHeading, EmptyState, IntegrationNotice } from '@/components/shared/page'
import { Badge, Card, Progress } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/fields'
import { plans } from './plans'

export default function BillingPage() {
  const { members } = useDemo()
  const [annual, setAnnual] = useState(false)
  const count = members.filter((m) => m.role !== 'Client').length
  return (
    <>
      <PageHeader
        eyebrow="ROOM TO GROW"
        title="Billing & plans"
        description="Explore the planned subscription experience. Prices and limits are illustrative."
        action={<Badge tone="violet">No active paid subscription</Badge>}
      />
      <IntegrationNotice>
        No payment provider is connected. The example Growth selection does not represent a
        purchased subscription or grant real entitlements.
      </IntegrationNotice>
      <Card className="current-plan">
        <div>
          <Badge tone="violet">Growth · illustrative selection</Badge>
          <h2>A little more space for good work.</h2>
          <p className="muted">
            Example monthly price: $49 USD. No charge, payment method, or renewal.
          </p>
          <Button
            onClick={() =>
              toast.info(
                'Billing integration is unavailable. No checkout or subscription change was started.',
              )
            }
          >
            Manage billing preview
            <ArrowUpRight size={14} />
          </Button>
        </div>
        <div className="usage-grid">
          <div>
            <div className="row-between">
              <span>Demo teammates</span>
              <strong>{count} / 20</strong>
            </div>
            <Progress value={(count / 20) * 100} />
            <small>Active internal fixture profiles</small>
          </div>
          <div>
            <div className="row-between">
              <span>Stored files</span>
              <strong>0 / 25 GB</strong>
            </div>
            <Progress value={0} />
            <small>No files have been uploaded</small>
          </div>
          <div>
            <div className="row-between">
              <span>Live AI usage</span>
              <strong>0 tokens</strong>
            </div>
            <Progress value={0} />
            <small>No model calls have been made</small>
          </div>
        </div>
      </Card>
      <div className="section-heading">
        <div>
          <h2>Find your fit</h2>
          <p className="muted">Illustrative USD pricing, not an offer for sale.</p>
        </div>
        <Switch label="Annual example · 20% less" checked={annual} onCheckedChange={setAnnual} />
      </div>
      <div className="pricing-grid">
        {plans.map((plan) => (
          <Card
            className={`pricing-card ${plan.name === 'Growth' ? 'featured-plan' : ''}`}
            key={plan.name}
          >
            {plan.name === 'Growth' && <span className="plan-tag">FEATURED EXAMPLE</span>}
            <h3>{plan.name}</h3>
            <p className="muted">{plan.description}</p>
            <p className="plan-price">
              ${annual ? (plan.monthly * 0.8).toFixed(2) : plan.monthly}
              <span>/ month</span>
            </p>
            <p className="field-hint">
              {annual
                ? `$${(plan.monthly * 0.8 * 12).toFixed(2)} USD/year example`
                : 'USD · illustrative monthly price'}
            </p>
            <Button
              variant={plan.name === 'Growth' ? 'primary' : 'secondary'}
              className="w-full"
              onClick={() =>
                toast.info(
                  `${plan.name} is an illustrative plan. Payments and plan changes are unavailable.`,
                )
              }
            >
              Preview {plan.name}
            </Button>
            <ul>
              {[
                `${plan.seats} internal seats`,
                `${plan.storage} illustrative storage`,
                plan.ai,
                ...plan.features,
              ].map((f) => (
                <li key={f}>
                  <Check size={15} />
                  {f}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <Card>
        <SectionHeading title="Billing history" />
        <EmptyState
          title="No billing activity"
          description="There are no invoices or transactions in this frontend preview."
          icon={<CreditCard size={26} />}
        />
      </Card>
    </>
  )
}
