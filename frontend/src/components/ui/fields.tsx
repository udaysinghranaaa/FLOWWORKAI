import {
  cloneElement,
  isValidElement,
  useId,
  type ComponentProps,
  type ReactNode,
  type ReactElement,
} from 'react'
import {
  Checkbox as CheckboxPrimitive,
  Switch as SwitchPrimitive,
  RadioGroup as RadioPrimitive,
} from 'radix-ui'
import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn('input', className)} {...props} />
}
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn('input textarea', className)} {...props} />
}
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn('input select', className)} {...props} />
}
export function DateInput(props: ComponentProps<'input'>) {
  return <Input type="date" {...props} />
}
export function Field({
  label,
  error,
  hint,
  children,
  id,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
  id: string
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children) && children.type !== 'div'
        ? cloneElement(
            children as ReactElement<{ 'aria-invalid'?: boolean; 'aria-describedby'?: string }>,
            {
              'aria-invalid': !!error,
              'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
            },
          )
        : children}
      {error ? (
        <p role="alert" id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
}) {
  const id = useId()
  return (
    <div className="search-input">
      <Search size={16} aria-hidden="true" />
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type="search"
      />
    </div>
  )
}
export function Checkbox({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="check-label">
      <CheckboxPrimitive.Root
        id={id}
        className="checkbox"
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      >
        <CheckboxPrimitive.Indicator>
          <Check size={13} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label}
    </label>
  )
}
export function Switch({
  label,
  checked,
  onCheckedChange,
  description,
}: {
  label: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
  description?: string
}) {
  const id = useId()
  return (
    <div className="switch-row">
      <div>
        <label htmlFor={id}>{label}</label>
        {description && <p className="muted text-sm">{description}</p>}
      </div>
      <SwitchPrimitive.Root
        id={id}
        className="switch"
        checked={checked}
        onCheckedChange={onCheckedChange}
      >
        <SwitchPrimitive.Thumb className="switch-thumb" />
      </SwitchPrimitive.Root>
    </div>
  )
}
export function RadioGroup({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  const id = useId()
  return (
    <RadioPrimitive.Root
      aria-label={label}
      value={value}
      onValueChange={onValueChange}
      className="radio-group"
    >
      {options.map((o, i) => (
        <label key={o.value} htmlFor={`${id}-${i}`} className="radio-option">
          <RadioPrimitive.Item id={`${id}-${i}`} value={o.value} className="radio">
            <RadioPrimitive.Indicator className="radio-dot" />
          </RadioPrimitive.Item>
          {o.label}
        </label>
      ))}
    </RadioPrimitive.Root>
  )
}
