import { useState } from 'react'
import { Link } from 'react-router'
import { MailCheck, ArrowRight, Building2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Brand } from '@/components/layout/app-shell'
import { Badge, Card } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/fields'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a workspace name.').max(120),
  slug: z.string().regex(/^[a-z0-9-]{3,63}$/, 'Use 3–63 lowercase letters, numbers, or hyphens.'),
  industry: z.string(),
})
export default function OnboardingPage({ verification = false }: { verification?: boolean }) {
  const [submitted, setSubmitted] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', industry: 'Software agency' },
  })
  return (
    <main className="onboarding-page">
      <Brand />
      <Card>
        {verification ? (
          <>
            <span className="onboarding-icon">
              <MailCheck size={30} />
            </span>
            <Badge tone="violet">EMAIL VERIFICATION · UI PREVIEW</Badge>
            <h1>
              A small step toward
              <br />a shared workspace.
            </h1>
            <p className="muted">
              In the future, a verification email will confirm your address before workspace
              creation or invitation acceptance.
            </p>
            <p className="auth-integration-result">
              No verification email was sent. No token is being processed and no account has been
              verified.
            </p>
            <Button asChild variant="primary">
              <Link to="/onboarding">
                View onboarding preview
                <ArrowRight size={16} />
              </Link>
            </Button>
          </>
        ) : (
          <>
            <span className="onboarding-icon">
              <Building2 size={29} />
            </span>
            <Badge tone="violet">WORKSPACE ONBOARDING · UI PREVIEW</Badge>
            <h1>A home for your team.</h1>
            <p className="muted">
              Preview the workspace setup. This form does not create a real organization or
              subscription.
            </p>
            <form
              className="form-stack"
              noValidate
              onSubmit={handleSubmit(() => setSubmitted(true))}
            >
              <Field id="onboarding-name" label="Workspace name" error={errors.name?.message}>
                <Input id="onboarding-name" {...register('name')} placeholder="Your studio name" />
              </Field>
              <Field id="onboarding-slug" label="Workspace slug" error={errors.slug?.message}>
                <Input id="onboarding-slug" {...register('slug')} placeholder="your-studio" />
              </Field>
              <Field id="onboarding-industry" label="What kind of work do you do?">
                <Select id="onboarding-industry" {...register('industry')}>
                  <option>Software agency</option>
                  <option>Digital marketing agency</option>
                  <option>Service business</option>
                  <option>Startup</option>
                </Select>
              </Field>
              <Button variant="primary" type="submit">
                Preview workspace setup
                <ArrowRight size={16} />
              </Button>
              {submitted && (
                <p className="auth-integration-result" role="status">
                  The form is valid. Workspace creation needs the backend; no organization,
                  membership, or subscription was created.
                </p>
              )}
            </form>
          </>
        )}
        <Button className="w-full" asChild>
          <Link to="/workspaces">Explore Demo Workspace</Link>
        </Button>
      </Card>
      <Link className="muted-link" to="/">
        ← Back to website
      </Link>
    </main>
  )
}
