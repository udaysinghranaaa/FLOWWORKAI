import { Select } from '@/components/ui/fields'
import type { Member } from '@/types/domain'
export function UserPicker({
  members,
  value,
  onChange,
  label = 'Assignee',
  id,
}: {
  members: Member[]
  value: string
  onChange: (value: string) => void
  label?: string
  id?: string
}) {
  return (
    <Select id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Unassigned</option>
      {members
        .filter((m) => m.role !== 'Client')
        .map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
    </Select>
  )
}
