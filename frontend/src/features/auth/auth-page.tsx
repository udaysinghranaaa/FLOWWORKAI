import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, ArrowRight, ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Brand } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/fields'
import { Badge } from '@/components/ui/display'
import { api, ApiClientError } from '@/services/api-client'
import { sessionKey } from './use-session'
import { useActionToken } from './use-action-token'
import { pendingInvitation } from '@/features/invitations/continuation'
import { pendingPortalInvitation } from '@/features/client-management/portal-continuation'

type Mode = 'login' | 'signup' | 'forgot' | 'reset'
const content: Record<Mode, { title: string; subtitle: string; button: string }> = {
  login: {
    title: 'Welcome back.',
    subtitle: 'A little focus. A fresh start. Your workspace is waiting.',
    button: 'Sign in',
  },
  signup: {
    title: 'Make room for good work.',
    subtitle: 'Explore a more connected way to work together.',
    button: 'Create account',
  },
  forgot: {
    title: 'Let’s find your way back.',
    subtitle: 'Request a one-time password reset link.',
    button: 'Request reset link',
  },
  reset: {
    title: 'A fresh start.',
    subtitle: 'Choose a new password using your one-time reset link.',
    button: 'Reset password',
  },
}
export default function AuthPage({ mode }: { mode: Mode }) {
  const [visible, setVisible] = useState(false)
  const [notice, setNotice] = useState('')
  const navigate = useNavigate(),
    queryClient = useQueryClient(),
    token = useActionToken()
  const hasPassword = mode !== 'forgot'
  const location = useLocation()
  const plan = new URLSearchParams(location.search).get('plan')
  const schema = z
    .object({
      name: z.string(),
      email: z.string(),
      password: z.string(),
      confirmPassword: z.string(),
    })
    .superRefine((v, ctx) => {
      if (mode === 'signup' && v.name.trim().length < 2)
        ctx.addIssue({ code: 'custom', path: ['name'], message: 'Enter at least 2 characters.' })
      if (mode !== 'reset' && !z.email().safeParse(v.email).success)
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter a valid email address.' })
      if (hasPassword && v.password.length < (mode === 'login' ? 1 : 12))
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message: mode === 'login' ? 'Enter your password.' : 'Use at least 12 characters.',
        })
      if (v.password.length > 128)
        ctx.addIssue({ code: 'custom', path: ['password'], message: 'Use at most 128 characters.' })
      if (mode === 'reset' && v.password !== v.confirmPassword)
        ctx.addIssue({
          code: 'custom',
          path: ['confirmPassword'],
          message: 'The passwords must match.',
        })
    })
  const {
    register,
    handleSubmit,
    resetField,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })
  return (
    <div className="auth-layout">
      <a className="skip-link" href="#auth-main">
        Skip to form
      </a>
      <aside className="auth-story">
        <Brand />
        <div>
          <Badge tone="violet">A MORE CONSIDERED WORKSPACE</Badge>
          <h2>
            Less switching.
            <br />
            More making
            <br />
            <span>things happen.</span>
          </h2>
          <p>A shared place for projects, people, and every thoughtful step in between.</p>
          <div className="auth-story-note">
            <Sparkles size={22} />
            <span>
              One Workspace.
              <br />
              Every Workflow. Powered by AI.
            </span>
          </div>
        </div>
        <small>Real account access · Demo workspace stays separate</small>
      </aside>
      <main className="auth-main" id="auth-main">
        <div className="auth-top">
          <Link to="/">← Back to website</Link>
          <Badge>ACCOUNT ACCESS</Badge>
        </div>
        <div className="auth-form-wrap">
          <Brand />
          <h1>{content[mode].title}</h1>
          <p className="muted">{content[mode].subtitle}</p>
          {mode === 'signup' && plan && ['starter', 'growth', 'business'].includes(plan) && (
            <Badge tone="violet">Illustrative {plan} plan preview · no purchase</Badge>
          )}
          <form
            className="form-stack"
            noValidate
            onSubmit={handleSubmit(async (values) => {
              setNotice('')
              try {
                if (mode === 'login') {
                  const result = await api.login(values.email, values.password)
                  queryClient.setQueryData(sessionKey, result.user)
                  navigate(
                    pendingPortalInvitation()
                      ? '/portal/invitations'
                      : pendingInvitation()
                        ? '/app/invitations'
                        : '/account',
                    { replace: true },
                  )
                } else if (mode === 'signup') {
                  const result = await api.register(values.name, values.email, values.password)
                  setNotice(
                    result.deliveryMode === 'development-capture'
                      ? 'If eligible, your verification link is in local development mail capture. Verify your email before signing in. No email delivery is claimed.'
                      : 'If eligible, check your email for a verification link before signing in.',
                  )
                } else if (mode === 'forgot') {
                  const result = await api.forgot(values.email)
                  setNotice(
                    result.deliveryMode === 'development-capture'
                      ? 'If eligible, reset instructions are in local development mail capture. No email delivery is claimed.'
                      : 'If eligible, check your email for password reset instructions.',
                  )
                } else {
                  if (!token) throw new Error('Open a valid reset link from your recovery message.')
                  await api.reset(token, values.password)
                  queryClient.setQueryData(sessionKey, null)
                  setNotice(
                    'Password updated. Existing sessions are signed out. You can now sign in.',
                  )
                }
              } catch (error) {
                setNotice(
                  error instanceof Error ? error.message : 'The request could not be completed.',
                )
                if (error instanceof ApiClientError)
                  for (const detail of error.details) {
                    const field = detail.path.replace(/^body\./, '')
                    if (field === 'name' || field === 'email' || field === 'password')
                      setError(field, { message: detail.message })
                  }
              } finally {
                resetField('password', { keepError: true })
                resetField('confirmPassword', { keepError: true })
              }
            })}
          >
            {mode === 'signup' && (
              <Field id="auth-name" label="Full name" error={errors.name?.message}>
                <Input
                  autoComplete="name"
                  id="auth-name"
                  {...register('name')}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'auth-name-error' : undefined}
                  placeholder="Your name"
                />
              </Field>
            )}
            {mode !== 'reset' && (
              <Field id="auth-email" label="Work email" error={errors.email?.message}>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'auth-email-error' : undefined}
                  placeholder="you@yourstudio.com"
                />
              </Field>
            )}
            {hasPassword && (
              <Field
                id="auth-password"
                label={mode === 'reset' ? 'New password' : 'Password'}
                error={errors.password?.message}
                hint={mode !== 'login' ? '12–128 characters. Use a unique password.' : undefined}
              >
                <div className="password-input">
                  <Input
                    id="auth-password"
                    type={visible ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    {...register('password')}
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      errors.password
                        ? 'auth-password-error'
                        : mode !== 'login'
                          ? 'auth-password-hint'
                          : undefined
                    }
                    placeholder={mode === 'login' ? 'Your password' : 'At least 12 characters'}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    onClick={() => setVisible((v) => !v)}
                  >
                    {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                  </Button>
                </div>
              </Field>
            )}
            {mode === 'reset' && (
              <Field
                id="auth-confirm"
                label="Confirm new password"
                error={errors.confirmPassword?.message}
              >
                <Input
                  id="auth-confirm"
                  type={visible ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={errors.confirmPassword ? 'auth-confirm-error' : undefined}
                />
              </Field>
            )}
            {mode === 'login' && (
              <Link to="/forgot-password" className="text-link forgot-link">
                Forgot password?
              </Link>
            )}
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Please wait…' : content[mode].button}
              <ArrowRight size={16} />
            </Button>
            {notice && (
              <p className="auth-integration-result" role="status">
                {notice}
              </p>
            )}
          </form>
          <div className="auth-divider">
            <span>or take a look around</span>
          </div>
          <Button className="w-full" asChild>
            <Link to="/w/studio/dashboard">
              Explore Demo Workspace
              <ArrowUpRight size={16} />
            </Link>
          </Button>
          <p className="auth-alternate">
            {mode === 'login' ? (
              <>
                New here? <Link to="/signup">Create account</Link>
              </>
            ) : (
              <>
                Already have an account? <Link to="/login">Back to login</Link>
              </>
            )}
          </p>
          <p className="auth-security-note">
            <ShieldCheck size={15} />
            Credentials go to the configured API. Sessions use HttpOnly cookies.
          </p>
          {mode === 'signup' && (
            <Link className="text-link" to="/verify-email">
              View email verification information
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
