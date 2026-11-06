import { describe, it, expect } from 'vitest'
import { createDemoRepository } from './demo-repository'
import { progress } from '@/lib/utils'
describe('demo repository boundaries and consistency', () => {
  it('publishes immutable snapshots and keeps dashboard completion in sync with task changes', () => {
    const repo = createDemoRepository()
    const original = repo.getSnapshot()
    const task = original.tasks.find((t) => t.id === 'FW-101')!
    const initial = progress(original.tasks)
    repo.updateTask('studio', task.id, { status: 'done' })
    expect(original.tasks.find((t) => t.id === task.id)?.status).toBe('in_progress')
    expect(repo.getSnapshot()).not.toBe(original)
    expect(progress(repo.getSnapshot().tasks)).toBeGreaterThan(initial)
    expect(repo.getSnapshot().tasks.find((t) => t.id === task.id)?.version).toBe(2)
  })
  it('rejects inconsistent cross-workspace references in the demo adapter', () => {
    const repo = createDemoRepository()
    const task = repo.getSnapshot().tasks[0]
    expect(() => repo.saveTask({ ...task, workspaceId: 'lab' })).toThrow('Choose a project')
    expect(() => repo.updateTask('lab', task.id, { status: 'done' })).toThrow('Task not found')
    expect(() =>
      repo.saveProject({ ...repo.getSnapshot().projects[0], workspaceId: 'lab' }),
    ).toThrow('Choose a client')
    expect(repo.getSnapshot().tasks).toHaveLength(14)
  })
  it('checks project assignment and client/project relationships', () => {
    const repo = createDemoRepository()
    expect(() => repo.updateTask('studio', 'FW-101', { assigneeId: 'm-riley' })).toThrow(
      'internal demo teammate',
    )
    expect(() =>
      repo.createTicket(
        {
          workspaceId: 'studio',
          clientId: 'c-bloom',
          projectId: 'p-orbit',
          subject: 'Invalid relationship',
          category: 'General',
          status: 'open',
          priority: 'normal',
          assigneeId: '',
        },
        'A sample message',
      ),
    ).toThrow('Project must belong')
  })
  it('deduplicates invitation drafts and restores all fixtures on reset', () => {
    const repo = createDemoRepository()
    repo.invite({ workspaceId: 'studio', email: 'person@example.com', role: 'Member' })
    expect(() =>
      repo.invite({ workspaceId: 'studio', email: 'PERSON@example.com', role: 'Member' }),
    ).toThrow('already has')
    repo.markRead('studio')
    expect(repo.getSnapshot().notifications.every((n) => n.read)).toBe(true)
    repo.reset()
    expect(repo.getSnapshot().invitations).toHaveLength(1)
    expect(repo.getSnapshot().notifications.filter((n) => !n.read)).toHaveLength(2)
  })
  it('keeps published client and active assignment relationships stable during project editing', () => {
    const repo = createDemoRepository()
    const project = repo.getSnapshot().projects[0]
    expect(() => repo.saveProject({ ...project, clientId: 'c-bloom' }, project.id)).toThrow(
      'cannot be moved',
    )
    expect(() => repo.saveProject({ ...project, memberIds: ['m-jordan'] }, project.id)).toThrow(
      'Reassign',
    )
  })
})
