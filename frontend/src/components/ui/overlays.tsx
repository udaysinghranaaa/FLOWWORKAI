import { useRef, type ReactNode } from 'react'
import {
  Dialog,
  AlertDialog,
  DropdownMenu,
  Tooltip as TooltipPrimitive,
  Popover as PopoverPrimitive,
} from 'radix-ui'
import { X } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from './button'
import { cn } from '@/lib/utils'

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = false,
  className,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  title: string
  description?: string
  children: ReactNode
  side?: boolean
  className?: string
}) {
  const previousFocus = useRef<HTMLElement | null>(null)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className={cn('dialog', side && 'sheet', className)}
          onOpenAutoFocus={() => {
            previousFocus.current = document.activeElement as HTMLElement | null
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            requestAnimationFrame(() => {
              if (previousFocus.current?.isConnected) previousFocus.current.focus()
              else document.querySelector<HTMLElement>('main h1')?.focus()
            })
          }}
        >
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description ?? 'Changes are for this demo only and reset on refresh.'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close dialog">
                <X size={18} />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
export function Sheet(props: Omit<Parameters<typeof Modal>[0], 'side'>) {
  return <Modal {...props} side />
}
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = 'Confirm',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  confirmLabel?: string
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="overlay" />
        <AlertDialog.Content className="dialog confirmation">
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          <div className="form-actions">
            <AlertDialog.Cancel asChild>
              <Button>Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="danger" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content sideOffset={8} className="tooltip">
          {label}
          <TooltipPrimitive.Arrow />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
export function Menu({
  trigger,
  items,
  label,
}: {
  trigger: ReactNode
  label: string
  items: { label: string; href?: string; onSelect?: () => void; destructive?: boolean }[]
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="dropdown" sideOffset={8} align="end">
          <DropdownMenu.Label className="menu-label">{label}</DropdownMenu.Label>
          <DropdownMenu.Separator className="separator" />
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              className={cn('menu-item', item.destructive && 'danger-text')}
              onSelect={item.onSelect}
              asChild={!!item.href}
            >
              {item.href ? <Link to={item.href}>{item.label}</Link> : item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
export function Popover({
  trigger,
  label,
  children,
}: {
  trigger: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          aria-label={label}
          className="popover"
          align="end"
          sideOffset={10}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
