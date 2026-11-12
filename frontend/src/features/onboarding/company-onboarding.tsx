import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSession } from '@/features/auth/use-session'
import { Brand, ThemeMenu } from '@/components/layout/app-shell'
import { Card, Badge } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/fields'
import { tenantApi } from '@/services/tenant-api'
import { TenantHeading } from '@/features/workspaces/tenant-context'
import { useTenantRefresh } from '@/features/workspaces/use-tenant'

const slug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{2,62}$/, 'Use 3–63 lowercase letters, numbers or hyphens.')
const schema = z.object({
  name: z.string().trim().min(2).max(120),
  slug,
  website: z.union([z.literal(''), z.url().refine((value) => /^https?:\/\//.test(value))]),
  industry: z.string().max(120),
  description: z.string().max(1000),
  workspaceName: z.string().trim().min(2).max(120),
  workspaceSlug: slug,
})
type Form = z.infer<typeof schema>
export default function CompanyOnboarding() {
  const [step, setStep] = useState(1),
    [key] = useState(() => crypto.randomUUID()),
    [error, setError] = useState(''),
    [created, setCreated] = useState<{ id: string; name: string } | null>(null)
  const refresh = useTenantRefresh(),
    { data: user } = useSession()
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      website: '',
      industry: '',
      description: '',
      workspaceName: 'Main workspace',
      workspaceSlug: 'main-workspace',
    },
  })
  async function next() {
    if (
      await trigger(
        step === 1
          ? ['name', 'slug', 'website', 'industry', 'description']
          : ['workspaceName', 'workspaceSlug'],
      )
    )
      setStep((value) => value + 1)
  }
  const details = getValues()
  return (
    <main className="tenant-onboarding">
      <header>
        <Brand />
        <ThemeMenu />
      </header>
      <Card>
        <Badge tone="violet">COMPANY SETUP · {created ? 'READY' : `STEP ${step} OF 3`}</Badge>
        <TenantHeading>
          {created ? 'Your company is ready.' : "Let's set up your company."}
        </TenantHeading>
        {created ? (
          <>
            <p>{created.name} is saved in your account.</p>
            <Button asChild variant="primary">
              <Link to={`/app/w/${created.id}/overview`}>Enter workspace</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="muted">
              Welcome, {user?.name}. Give your company a home for the work ahead.
            </p>
            <form
              className="form-stack"
              noValidate
              onSubmit={handleSubmit(async (values) => {
                setError('')
                try {
                  const result = await tenantApi.createCompany({ ...values, creationKey: key })
                  await refresh()
                  setCreated({ id: result.workspace.id, name: result.organization.name })
                } catch (error) {
                  setError(
                    error instanceof Error ? error.message : 'Could not create your company.',
                  )
                }
              })}
            >
              {step === 1 && (
                <>
                  <Field id="company-name" label="Company name" error={errors.name?.message}>
                    <Input
                      id="company-name"
                      {...register('name', {
                        onBlur: (event) => {
                          if (!getValues('slug'))
                            setValue(
                              'slug',
                              String(event.target.value)
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, '-')
                                .replace(/^-|-$/g, '')
                                .slice(0, 63),
                            )
                        },
                      })}
                      autoComplete="organization"
                    />
                  </Field>
                  <Field id="company-slug" label="Company slug" error={errors.slug?.message}>
                    <Input id="company-slug" {...register('slug')} />
                  </Field>
                  <Field
                    id="company-website"
                    label="Website (optional)"
                    error={errors.website?.message}
                  >
                    <Input id="company-website" {...register('website')} placeholder="https://" />
                  </Field>
                  <Field
                    id="company-industry"
                    label="Industry (optional)"
                    error={errors.industry?.message}
                  >
                    <Input id="company-industry" {...register('industry')} />
                  </Field>
                  <Field
                    id="company-description"
                    label="Description (optional)"
                    error={errors.description?.message}
                  >
                    <Textarea id="company-description" {...register('description')} />
                  </Field>
                </>
              )}
              {step === 2 && (
                <>
                  <Field
                    id="first-workspace"
                    label="Workspace name"
                    error={errors.workspaceName?.message}
                  >
                    <Input id="first-workspace" {...register('workspaceName')} />
                  </Field>
                  <Field
                    id="first-workspace-slug"
                    label="Workspace slug"
                    error={errors.workspaceSlug?.message}
                  >
                    <Input id="first-workspace-slug" {...register('workspaceSlug')} />
                  </Field>
                </>
              )}
              {step === 3 && (
                <div className="tenant-review">
                  <h2>Review your company</h2>
                  <p>
                    <strong>{details.name}</strong> · {details.slug}
                  </p>
                  <p>First workspace: {details.workspaceName}</p>
                  <p className="muted">
                    You will become the founding owner. No subscription or sample business records
                    will be created.
                  </p>
                </div>
              )}
              {error && <p role="alert">{error}</p>}
              <div className="tenant-actions">
                {step > 1 && (
                  <Button disabled={isSubmitting} onClick={() => setStep((value) => value - 1)}>
                    Back
                  </Button>
                )}
                {step < 3 ? (
                  <Button
                    key="continue"
                    variant="primary"
                    onClick={(event) => {
                      event.preventDefault()
                      void next()
                    }}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button key="create" variant="primary" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating company…' : 'Create company'}
                  </Button>
                )}
              </div>
            </form>
          </>
        )}
        <Link to="/account">Back to account</Link>
      </Card>
    </main>
  )
}
