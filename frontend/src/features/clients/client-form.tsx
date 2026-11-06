import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useDemo } from '@/hooks/use-demo'
import type { Client } from '@/types/domain'
import { Modal } from '@/components/ui/overlays'
import { Button } from '@/components/ui/button'
import { Input, Field, Select } from '@/components/ui/fields'

const schema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters.').max(120),
  contactName: z.string().trim().min(2, 'Enter a contact name.'),
  email: z.email('Enter a valid email address.'),
  website: z.union([
    z
      .url('Enter a valid https:// website.')
      .refine((v) => /^https?:\/\//.test(v), 'Use an http or https address.'),
    z.literal(''),
  ]),
  industry: z.string().trim().min(2, 'Enter an industry.'),
  status: z.enum(['active', 'archived']),
})
type Values = z.infer<typeof schema>
export default function ClientForm({ client, onClose }: { client?: Client; onClose: () => void }) {
  const { repository, workspaceId } = useDemo()
  const [failure, setFailure] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: client?.name ?? '',
      contactName: client?.contactName ?? '',
      email: client?.email ?? '',
      website: client?.website ?? '',
      industry: client?.industry ?? '',
      status: client?.status ?? 'active',
    },
  })
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={client ? 'Edit client' : 'Add a client'}
    >
      <form
        noValidate
        className="form-stack"
        onSubmit={handleSubmit((v) => {
          try {
            repository.saveClient(
              { ...v, workspaceId, color: client?.color ?? 'violet' },
              client?.id,
            )
            toast.success(client ? 'Client updated in demo' : 'Client added in demo')
            onClose()
          } catch (e) {
            setFailure(e instanceof Error ? e.message : 'Unable to save client.')
          }
        })}
      >
        <Field id="client-name" label="Company name" error={errors.name?.message}>
          <Input
            id="client-name"
            {...register('name')}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'client-name-error' : undefined}
            autoFocus
          />
        </Field>
        <div className="form-grid">
          <Field id="client-contact" label="Contact name" error={errors.contactName?.message}>
            <Input id="client-contact" {...register('contactName')} />
          </Field>
          <Field id="client-email" label="Email" error={errors.email?.message}>
            <Input id="client-email" type="email" {...register('email')} />
          </Field>
        </div>
        <Field id="client-website" label="Website (optional)" error={errors.website?.message}>
          <Input id="client-website" {...register('website')} placeholder="https://example.com" />
        </Field>
        <div className="form-grid">
          <Field id="client-industry" label="Industry" error={errors.industry?.message}>
            <Input id="client-industry" {...register('industry')} />
          </Field>
          <Field id="client-status" label="Status">
            <Select id="client-status" {...register('status')}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        </div>
        {failure && (
          <p className="field-error" role="alert">
            {failure}
          </p>
        )}
        <div className="form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            {client ? 'Save client' : 'Add client'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
