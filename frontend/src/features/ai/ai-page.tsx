import { useState } from 'react'
import { Link } from 'react-router'
import {
  Sparkles,
  Plus,
  ArrowUpRight,
  ArrowUp,
  BookOpen,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { isOverdue } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/fields'
import { Avatar, Badge } from '@/components/ui/display'
import { PageHeader, IntegrationNotice } from '@/components/shared/page'

interface Message {
  id: number
  role: 'user' | 'sample'
  content: string
  sourceId?: string
}
interface Conversation {
  id: number
  title: string
  messages: Message[]
}
const suggestions = [
  'Summarize my projects',
  'Identify overdue tasks',
  'Draft a client update',
  'Summarize this support ticket',
  'Search the knowledge base',
]
export default function AIPage() {
  const { projects, tasks, tickets, state, workspaceId, base } = useDemo()
  const docs = state.documents.filter((d) => d.workspaceId === workspaceId && d.status === 'ready')
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: 1,
      title: 'A clearer view of your work',
      messages: [
        {
          id: 1,
          role: 'sample',
          content:
            'Welcome to the FlowAI preview. Open a sample prompt to explore the planned experience. These responses are scripted frontend examples, not output from an AI model.',
        },
      ],
    },
  ])
  const [active, setActive] = useState(1)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const conversation = conversations.find((c) => c.id === active) ?? conversations[0]
  function sample(prompt: string) {
    const overdue = tasks.filter(isOverdue)
    if (prompt === suggestions[0])
      return {
        content: `Sample project summary\n\n${projects.length} projects are represented in this workspace; ${projects.filter((p) => p.status === 'active').length} are active. ${tasks.filter((t) => t.status === 'done').length} of ${tasks.length} tasks are complete.\n\n${projects.length ? 'A useful next step: review upcoming milestones with your project leads and check work waiting for review.' : 'This workspace is empty. Create a project to explore delivery workflows.'}`,
        sourceId: docs[0]?.id,
      }
    if (prompt === suggestions[1])
      return {
        content: `Sample overdue-work summary\n\n${overdue.length ? overdue.map((t) => `• ${t.id}: ${t.title} — due ${t.dueAt}`).join('\n') : 'There are no overdue demo tasks.'}\n\nOverdue is calculated against the fixed demo date, 6 November 2026. This is a local fixture calculation, not AI reasoning.`,
      }
    if (prompt === suggestions[2])
      return {
        content:
          'Sample client-update draft\n\nHi Riley,\n\nA quick note from the studio: we’re refining the next experience design milestone and gathering team feedback. We’ll share reviewed concepts with you before the next checkpoint.\n\nThanks for being part of the process.\nThe Northstar team\n\nFictional draft only. Please review facts and dates before using it.',
        sourceId: docs[0]?.id,
      }
    if (prompt === suggestions[3])
      return {
        content: tickets[0]
          ? `Sample support summary\n\n#${tickets[0].number}: ${tickets[0].subject}\nPriority: ${tickets[0].priority}. Current status: ${tickets[0].status.replaceAll('_', ' ')}.\n\nSuggested next step: review the conversation and confirm the next action with the responsible teammate.\n\nThis example reads fixture fields only.`
          : 'There are no support tickets in this demo workspace.',
      }
    if (prompt === suggestions[4])
      return docs.length
        ? {
            content: `Sample knowledge preview\n\nAvailable ready documents:\n${docs.map((d) => `• ${d.title}`).join('\n')}\n\nOpen a source to read the sample text. Semantic search, embeddings, and RAG are not connected.`,
            sourceId: docs[0]?.id,
          }
        : {
            content:
              'There are no ready sample documents in this workspace. Upload and indexing integrations are unavailable.',
          }
    return {
      content:
        'Live AI integration is unavailable. Your message was not sent to a model or any external service. Choose one of the sample prompts to explore a scripted response, or browse the knowledge base directly.',
    }
  }
  async function send(prompt: string) {
    if (!prompt.trim() || loading) return
    const targetId = active
    setInput('')
    setLoading(true)
    const result = sample(prompt.trim())
    const userMessage: Message = {
      id: conversation.messages.length + 1,
      role: 'user',
      content: prompt.trim(),
    }
    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetId
          ? {
              ...c,
              title: c.messages.length <= 1 ? prompt.slice(0, 36) : c.title,
              messages: [...c.messages, userMessage],
            }
          : c,
      ),
    )
    await new Promise((resolve) => setTimeout(resolve, 250)) // Clearly labeled sample-opening state; no network request.
    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetId
          ? {
              ...c,
              messages: [...c.messages, { id: userMessage.id + 1, role: 'sample', ...result }],
            }
          : c,
      ),
    )
    setLoading(false)
  }
  return (
    <>
      <PageHeader
        eyebrow="CONTEXT, WITHOUT THE CONTEXT SWITCHING"
        title="FlowAI Assistant"
        description="A little help with the bigger picture. Explore the shape of an AI-assisted workspace."
        action={
          <Badge tone="violet">
            <Sparkles size={13} />
            Scripted preview · no live AI
          </Badge>
        }
      />
      <div className="ai-workspace">
        <aside className="conversation-sidebar">
          <Button
            className="w-full"
            disabled={loading}
            onClick={() => {
              const id = Math.max(...conversations.map((c) => c.id)) + 1
              setConversations((cs) => [
                ...cs,
                { id, title: 'New sample conversation', messages: [] },
              ])
              setActive(id)
            }}
          >
            <Plus size={16} />
            New conversation
          </Button>
          <p className="nav-group-label">IN THIS BROWSER SESSION</p>
          {conversations.map((c) => (
            <button
              key={c.id}
              className={`conversation-link ${c.id === active ? 'active' : ''}`}
              onClick={() => setActive(c.id)}
            >
              <MessageSquare size={15} />
              <span>{c.title}</span>
            </button>
          ))}
          <div className="ai-usage">
            <Badge>Usage preview</Badge>
            <strong>No model calls made</strong>
            <p>Quotas and token accounting will connect to the backend in a later phase.</p>
          </div>
        </aside>
        <section className="chat-panel" aria-label="Sample conversation">
          <header className="chat-header">
            <div className="inline-flex items-center gap-2">
              <Sparkles size={16} />
              <strong>FlowAI</strong>
              <Badge>Sample content</Badge>
            </div>
            <Link className="text-link" to={`${base}/knowledge`}>
              Sources
              <BookOpen size={14} />
            </Link>
          </header>
          <div className="chat-messages" aria-live="polite" aria-relevant="additions">
            {!conversation.messages.length && (
              <div className="ai-empty">
                <div className="ai-symbol">
                  <Sparkles size={28} />
                </div>
                <h2>
                  A fresh perspective starts
                  <br />
                  with a good question.
                </h2>
                <p>Choose a prompt below to open a scripted example.</p>
              </div>
            )}
            {conversation.messages.map((m) => (
              <article key={m.id} className={`chat-message ${m.role}`}>
                <div>
                  {m.role === 'sample' ? (
                    <span className="ai-symbol small">
                      <Sparkles size={16} />
                    </span>
                  ) : (
                    <Avatar name="Jordan Lee" size="small" />
                  )}
                </div>
                <div>
                  <strong>
                    {m.role === 'sample' ? 'FlowAI · scripted example' : 'You · demo visitor'}
                  </strong>
                  <p>{m.content}</p>
                  {m.sourceId && (
                    <Link className="source-reference" to={`${base}/knowledge/${m.sourceId}`}>
                      <BookOpen size={15} />
                      <span>Sample source · {docs.find((d) => d.id === m.sourceId)?.title}</span>
                      <ArrowUpRight size={14} />
                    </Link>
                  )}
                </div>
              </article>
            ))}
            {loading && (
              <div role="status" className="sample-loading">
                <Loader2 className="spin" size={16} />
                Opening scripted sample…
              </div>
            )}
          </div>
          <div className="prompt-suggestions">
            {suggestions.map((p) => (
              <button key={p} onClick={() => void send(p)} disabled={loading}>
                {p}
                <ArrowUpRight size={12} />
              </button>
            ))}
          </div>
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <label htmlFor="ai-prompt" className="sr-only">
              Message FlowAI preview
            </label>
            <Textarea
              id="ai-prompt"
              placeholder="Ask a question, or explore a sample prompt…"
              maxLength={4000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              size="icon"
              disabled={loading || !input.trim()}
              aria-label="Send demo message"
            >
              <ArrowUp size={18} />
            </Button>
          </form>
          <p className="chat-disclaimer">
            Scripted examples only. No live model, real document retrieval, or business actions.
          </p>
        </section>
      </div>
      <IntegrationNotice>
        FlowAI is a frontend demonstration. Sample responses can be incomplete; verify anything you
        choose to reuse.
      </IntegrationNotice>
    </>
  )
}
