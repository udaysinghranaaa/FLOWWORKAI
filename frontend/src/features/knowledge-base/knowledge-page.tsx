import { Separator } from '@/components/ui/separator'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Upload, BookOpen, FileText, ArrowUpRight, Search, AlertCircle } from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { Button } from '@/components/ui/button'
import { Badge, Card, Table } from '@/components/ui/display'
import { Input, SearchInput } from '@/components/ui/fields'
import { Modal } from '@/components/ui/overlays'
import { PageHeader, EmptyState, IntegrationNotice } from '@/components/shared/page'
import { formatDate } from '@/lib/utils'

export default function KnowledgePage() {
  const { state, workspaceId, base } = useDemo()
  const { documentId } = useParams()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All documents')
  const [upload, setUpload] = useState(false)
  const [selected, setSelected] = useState<{ name: string; size: number } | null>(null)
  const documents = state.documents.filter((d) => d.workspaceId === workspaceId)
  const document = documents.find((d) => d.id === documentId)
  const filtered = documents.filter(
    (d) =>
      `${d.title} ${d.content}`.toLowerCase().includes(search.toLowerCase()) &&
      (category === 'All documents' || d.category === category),
  )
  if (documentId)
    return document ? (
      <>
        <Link className="back-link" to={`${base}/knowledge`}>
          ← Knowledge base
        </Link>
        <PageHeader
          eyebrow={document.category.toUpperCase()}
          title={document.title}
          description={`Sample document · ${document.pages} pages · Updated ${formatDate(document.updatedAt)}`}
          action={
            <Badge
              tone={
                document.status === 'ready'
                  ? 'green'
                  : document.status === 'failed'
                    ? 'rose'
                    : 'amber'
              }
            >
              {document.status} · sample state
            </Badge>
          }
        />
        <Card className="document-reader">
          <div className="document-icon">
            <FileText size={25} />
          </div>
          <Separator className="mb-6" />
          <p className="document-content">{document.content}</p>
        </Card>
        <IntegrationNotice>
          These are static sample passages. No file was uploaded, parsed, scanned, indexed, or sent
          to an AI provider.
        </IntegrationNotice>
      </>
    ) : (
      <EmptyState
        title="Document not found"
        action={
          <Button asChild>
            <Link to={`${base}/knowledge`}>Back to documents</Link>
          </Button>
        }
      />
    )
  return (
    <>
      <PageHeader
        eyebrow="A SHARED MEMORY FOR YOUR TEAM"
        title="Knowledge base"
        description="Briefs, playbooks, and the context that makes work click."
        action={
          <Button variant="primary" onClick={() => setUpload(true)}>
            <Upload size={16} />
            Upload preview
          </Button>
        }
      />
      <div className="knowledge-feature">
        <div className="ai-symbol">
          <BookOpen size={24} />
        </div>
        <div>
          <h2>Less hunting. More knowing.</h2>
          <p>
            Keep the answers close to the work. Explore sample documents or the planned AI search
            experience.
          </p>
        </div>
        <Button asChild>
          <Link to={`${base}/ai`}>
            <Search size={15} />
            AI search preview
          </Link>
        </Button>
      </div>
      <div className="knowledge-layout">
        <aside className="category-list" aria-label="Knowledge categories">
          {['All documents', ...new Set(documents.map((d) => d.category))].map((c) => (
            <button
              className={category === c ? 'active' : ''}
              key={c}
              onClick={() => setCategory(c)}
            >
              <BookOpen size={15} />
              {c}
              <span>
                {c === 'All documents'
                  ? documents.length
                  : documents.filter((d) => d.category === c).length}
              </span>
            </button>
          ))}
        </aside>
        <div>
          <div className="filter-bar">
            <SearchInput
              value={search}
              onChange={setSearch}
              label="Search sample documents"
              placeholder="Search titles and sample text…"
            />
            <Badge>Local text search</Badge>
          </div>
          <Card className="table-card">
            <Table
              rows={filtered}
              getKey={(d) => d.id}
              caption="Sample knowledge documents"
              columns={[
                {
                  label: 'Document',
                  render: (d) => (
                    <Link className="document-title" to={`${base}/knowledge/${d.id}`}>
                      <FileText size={19} />
                      <span>
                        <strong>{d.title}</strong>
                        <small>{d.pages} sample pages</small>
                      </span>
                    </Link>
                  ),
                },
                { label: 'Category', render: (d) => <Badge>{d.category}</Badge> },
                {
                  label: 'Index status',
                  render: (d) => (
                    <Badge
                      tone={
                        d.status === 'ready' ? 'green' : d.status === 'failed' ? 'rose' : 'amber'
                      }
                    >
                      {d.status === 'failed' && <AlertCircle size={12} />}
                      {d.status} · sample
                    </Badge>
                  ),
                },
                { label: 'Updated', render: (d) => formatDate(d.updatedAt) },
                {
                  label: 'Open',
                  render: (d) => (
                    <Link to={`${base}/knowledge/${d.id}`} aria-label={`Read ${d.title}`}>
                      <ArrowUpRight size={17} />
                    </Link>
                  ),
                },
              ]}
            />
            {!filtered.length && (
              <EmptyState
                title="No documents found"
                description="Try another category or a different phrase."
              />
            )}
          </Card>
        </div>
      </div>
      <Modal
        open={upload}
        onOpenChange={(v) => {
          setUpload(v)
          if (!v) setSelected(null)
        }}
        title="Document upload preview"
        description="Inspect a filename locally. No file contents are read, uploaded, or indexed."
      >
        <div className="upload-zone">
          <Upload size={32} />
          <h3>A home for your team’s context</h3>
          <p>PDF or TXT · preview only · suggested maximum 20 MiB</p>
          <label className="sr-only" htmlFor="knowledge-file">
            Choose a file for local metadata preview
          </label>
          <Input
            type="file"
            id="knowledge-file"
            accept=".pdf,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0]
              setSelected(f ? { name: f.name, size: f.size } : null)
            }}
          />
          {selected && (
            <div className="file-preview">
              <strong>{selected.name}</strong>
              <span>{Math.round(selected.size / 1024)} KiB · not uploaded</span>
              {selected.size > 20 * 1024 * 1024 && (
                <p className="field-error">Above the planned 20 MiB upload limit.</p>
              )}
            </div>
          )}
        </div>
        <IntegrationNotice>
          Private storage, malware scanning, extraction, and indexing are unavailable until backend
          integration.
        </IntegrationNotice>
        <div className="form-actions">
          <Button onClick={() => setUpload(false)}>Close preview</Button>
        </div>
      </Modal>
    </>
  )
}
