import { useClientRefresh } from './use-client'
import { useId, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/features/auth/use-session'
import { clientApi } from '@/services/client-api'
import { Button } from '@/components/ui/button'
import { Card, LoadingState } from '@/components/ui/display'
import { Field, Input, Select, Textarea } from '@/components/ui/fields'
import { EmptyState } from '@/components/shared/page'
import { Pager } from '@/features/work-management/work-ui'
export interface FormField {
  name: string
  label: string
  type?: 'text' | 'email' | 'url' | 'date' | 'number' | 'textarea' | 'select' | 'checkbox'
  options?: { value: string; label: string }[]
  required?: boolean
  max?: number
  value?: string | number | boolean
}
export function ClientForm({
  fields,
  submit,
  label = 'Save changes',
  after,
}: {
  fields: FormField[]
  submit: (body: Record<string, unknown>, creationKey: string) => Promise<unknown>
  label?: string
  after?: () => void
}) {
  const id = useId(),
    {
      register,
      handleSubmit,
      formState: { isSubmitting, errors },
    } = useForm<Record<string, string | boolean>>(),
    [creationKey, setCreationKey] = useState(() => crypto.randomUUID()),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false)
  return (
    <form
      className="client-form"
      onSubmit={handleSubmit(async (values) => {
        setError('')
        setSaved(false)
        try {
          const body: Record<string, unknown> = {}
          for (const field of fields) {
            const v = values[field.name]
            body[field.name] =
              field.type === 'number' ? Number(v) : field.type === 'checkbox' ? !!v : (v ?? '')
          }
          await submit(body, creationKey)
          setCreationKey(crypto.randomUUID())
          setSaved(true)
          after?.()
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Unable to save.')
        }
      })}
    >
      {fields.map((f) => (
        <Field
          key={f.name}
          id={id + f.name}
          label={f.label}
          error={errors[f.name] ? 'Complete this field.' : undefined}
        >
          {f.type === 'select' ? (
            <Select
              id={id + f.name}
              defaultValue={String(f.value ?? '')}
              {...register(f.name, { required: f.required })}
            >
              {f.options?.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : f.type === 'textarea' ? (
            <Textarea
              id={id + f.name}
              maxLength={f.max ?? 5000}
              defaultValue={String(f.value ?? '')}
              {...register(f.name, { required: f.required })}
            />
          ) : (
            <Input
              id={id + f.name}
              type={f.type ?? 'text'}
              maxLength={f.max ?? 160}
              min={f.type === 'number' ? 0 : undefined}
              max={f.type === 'number' ? f.max : undefined}
              defaultValue={f.type === 'checkbox' ? undefined : String(f.value ?? '')}
              defaultChecked={f.type === 'checkbox' ? !!f.value : undefined}
              {...register(f.name, { required: f.required })}
            />
          )}
        </Field>
      ))}
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">Saved successfully.</p>}
      <Button variant="primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Saving…' : label}
      </Button>
    </form>
  )
}
export function QueryState({
  pending,
  error,
  retry,
  children,
}: {
  pending: boolean
  error: Error | null
  retry: () => void
  children: ReactNode
}) {
  if (pending) return <LoadingState label="Checking access and loading…" />
  if (error)
    return (
      <Card>
        <p role="alert">{error.message}</p>
        <Button onClick={retry}>Retry</Button>
      </Card>
    )
  return <>{children}</>
}
export function ClientList<T extends { id: string }>({
  path,
  filters = {},
  render,
  empty = 'Nothing here yet.',
}: {
  path: string
  filters?: Record<string, string>
  render: (row: T) => ReactNode
  empty?: string
}) {
  const [cursor, setCursor] = useState<string | null>(null),
    { data: user } = useSession()
  const result = useQuery({
    queryKey: ['clients', user?.id, path, filters, cursor],
    queryFn: ({ signal }) => clientApi.list<T>(path, { ...filters, cursor }, signal),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 10000,
  })
  return (
    <QueryState
      pending={result.isPending || (!result.isFetchedAfterMount && !result.isError)}
      error={result.error}
      retry={() => {
        void result.refetch()
      }}
    >
      {result.data?.items.length ? (
        <div className="client-stack">
          {result.data.items.map((r) => (
            <div key={r.id}>{render(r)}</div>
          ))}
        </div>
      ) : (
        <EmptyState title={empty} description="Your authorized records will appear here." />
      )}
      <Pager cursor={cursor} next={result.data?.nextCursor ?? null} onPage={setCursor} />
    </QueryState>
  )
}
export function Action({
  children,
  run,
  confirm,
}: {
  children: ReactNode
  run: () => Promise<unknown>
  confirm?: string
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [armed, setArmed] = useState(false),
    refresh = useClientRefresh()
  return (
    <>
      <Button
        disabled={busy}
        onClick={async () => {
          if (confirm && !armed) {
            setArmed(true)
            return
          }
          setBusy(true)
          setError('')
          try {
            await run()
            await refresh()
            setArmed(false)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Action failed.')
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Saving…' : armed ? 'Confirm' : children}
      </Button>
      {armed && (
        <span role="status">
          {confirm}
          <Button onClick={() => setArmed(false)}>Cancel</Button>
        </span>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  )
}
