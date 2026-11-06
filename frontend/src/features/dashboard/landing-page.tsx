import { Link } from 'react-router'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FolderKanban,
  Users,
  LifeBuoy,
  Sparkles,
  CheckSquare2,
  BookOpen,
  MessageSquare,
  Layers3,
  CircleCheck,
  ShieldCheck,
  MoveRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, Badge } from '@/components/ui/display'
import MarketingPreview from './marketing-preview'

const features = [
  {
    Icon: FolderKanban,
    label: 'Project clarity',
    title: 'Give every project a direction.',
    text: 'Keep the brief, tasks, milestones, and people in one considered workspace.',
    path: 'projects',
    tone: 'violet',
  },
  {
    Icon: CheckSquare2,
    label: 'Focused delivery',
    title: 'From next step to well done.',
    text: 'A task list when you need focus. A board when you need the bigger picture.',
    path: 'tasks',
    tone: 'cyan',
  },
  {
    Icon: Users,
    label: 'Client collaboration',
    title: 'Bring clients closer to the work.',
    text: 'Preview a simpler space for shared progress, milestones, and feedback.',
    path: 'portal/dashboard',
    tone: 'green',
  },
  {
    Icon: LifeBuoy,
    label: 'Thoughtful support',
    title: 'Keep every conversation moving.',
    text: 'A shared inbox with clear ownership and a place for internal context.',
    path: 'tickets',
    tone: 'amber',
  },
]
export default function LandingPage() {
  return (
    <>
      <section className="hero public-section">
        <div className="hero-announcement">
          <span className="demo-dot" />
          INTRODUCING FLOWWORK AI
          <span>
            Frontend preview
            <ArrowUpRight size={12} />
          </span>
        </div>
        <h1>
          One Workspace.
          <br />
          Every Workflow.
          <br />
          <span>Powered by AI.</span>
        </h1>
        <p className="hero-subtitle">
          Manage projects, teams, clients, and customer support
          <br className="desktop-only" /> in one intelligent workspace. More clarity. Less
          switching.
        </p>
        <div className="hero-actions">
          <Button asChild variant="primary">
            <Link to="/w/studio/dashboard">
              Explore Demo Workspace
              <ArrowUpRight size={17} />
            </Link>
          </Button>
          <Button asChild>
            <Link to="/features">
              See what’s inside
              <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
        <p className="hero-note">
          <Check size={13} />
          No signup required<span>·</span>Fictional data<span>·</span>No live services
        </p>
        <div className="hero-preview-wrap">
          <div className="preview-topline">
            <span>
              <i />
              <i />
              <i />
            </span>
            <small>flowwork / your-work-in-perspective</small>
            <span>
              <ShieldCheck size={12} />
              Demo preview
            </span>
          </div>
          <MarketingPreview />
        </div>
        <div className="hero-caption">
          <span>A shared home for the work you care about.</span>
          <span>Designed for software & digital marketing agencies.</span>
        </div>
      </section>
      <section className="public-section problem-section">
        <p className="eyebrow">LESS SCATTERED. MORE CONNECTED.</p>
        <div className="problem-grid">
          <h2>
            Your work is connected.
            <br />
            Your tools should be, too.
          </h2>
          <div>
            <p>
              Projects in one tab. Client feedback in another. That important brief somewhere in
              between.
            </p>
            <p>
              FlowWork AI brings the everyday rhythm of agency work together, so your team can spend
              less time finding context and more time making progress.
            </p>
            <Link to="/features" className="text-link">
              Meet a more considered workspace
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <div className="problem-tags">
          <span>
            <Layers3 size={17} />
            Fewer context switches
          </span>
          <span>
            <MessageSquare size={17} />
            Clearer conversations
          </span>
          <span>
            <CircleCheck size={17} />
            More intentional progress
          </span>
        </div>
      </section>
      <section className="public-section">
        <div className="section-intro">
          <p className="eyebrow">EVERYDAY WORK. A BETTER RHYTHM.</p>
          <h2>
            Everything has a place.
            <br />
            Everyone has a clear next step.
          </h2>
          <p>Explore connected frontend workflows, built around the way agencies deliver.</p>
        </div>
        <div className="marketing-feature-grid">
          {features.map(({ Icon, label, title, text, path, tone }) => (
            <article key={label}>
              <span className={`feature-icon avatar-${tone}`}>
                <Icon size={22} />
              </span>
              <p className="eyebrow">{label}</p>
              <h3>{title}</h3>
              <p>{text}</p>
              <Link to={`/w/studio/${path}`}>
                Explore preview
                <ArrowUpRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section id="workflow" className="public-section workflow-section">
        <div className="section-intro">
          <p className="eyebrow">FROM FIRST BRIEF TO FINAL HANDOFF</p>
          <h2>
            Built for the way
            <br />
            agencies make things happen.
          </h2>
          <p>Software delivery, campaign launches, and the relationships behind them.</p>
        </div>
        <div className="workflow-steps">
          {[
            {
              number: '01',
              title: 'Bring the brief together',
              text: 'A client, a shared outcome, and the context your team needs.',
            },
            {
              number: '02',
              title: 'Make a plan that moves',
              text: 'Break the work into tasks. Give every next step an owner.',
            },
            {
              number: '03',
              title: 'Keep the conversation close',
              text: 'Review ideas, share progress, and give clients a focused view.',
            },
            {
              number: '04',
              title: 'Deliver with a clear view',
              text: 'Track milestones and learn from the work, together.',
            },
          ].map((s) => (
            <article key={s.number}>
              <span>{s.number}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="public-section showcase-grid">
        <div>
          <Badge tone="violet">
            <Sparkles size={13} />
            FLOWAI · PLANNED ASSISTANCE
          </Badge>
          <h2>
            Keep your context.
            <br />
            Find a fresh perspective.
          </h2>
          <p>
            Explore how project summaries, client-update drafts, and source references could fit
            into your day. The preview uses scripted examples, with no live AI model or automated
            actions.
          </p>
          <Button asChild>
            <Link to="/w/studio/ai">
              Meet the FlowAI preview
              <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
        <div className="marketing-ai-preview">
          <div className="row-between">
            <span className="inline-flex items-center gap-2">
              <Sparkles size={17} />
              FlowAI
            </span>
            <Badge>Scripted example</Badge>
          </div>
          <div className="mini-chat-user">What should we focus on next?</div>
          <div className="mini-chat-answer">
            <Sparkles size={17} />
            <p>
              Start with a clear view of what’s due. Review open tasks, check the next milestone,
              and bring any blockers into the conversation.
            </p>
          </div>
          <span className="source-reference">
            <BookOpen size={14} />
            Sample · Studio delivery playbook
          </span>
          <small>No live model or retrieval connection.</small>
        </div>
      </section>
      <section className="public-section showcase-grid collaboration-showcase">
        <div className="collaboration-preview">
          <div className="row-between">
            <h3>One team. A shared direction.</h3>
            <Badge tone="green">Sample workspace</Badge>
          </div>
          {[
            {
              name: 'Maya Chen',
              text: 'The experience concepts are ready for a first look.',
              color: 'rose',
            },
            {
              name: 'Alex Morgan',
              text: 'The component library is in review. Ready for feedback.',
              color: 'cyan',
            },
            {
              name: 'Sam Rivera',
              text: 'Content is aligned with the next milestone.',
              color: 'amber',
            },
          ].map((p) => (
            <div className="comment" key={p.name}>
              <Avatar name={p.name} color={p.color} />
              <div>
                <strong>{p.name}</strong>
                <p>{p.text}</p>
              </div>
            </div>
          ))}
          <div className="collaboration-footer">
            <span className="avatar-group">
              <Avatar name="Jordan Lee" size="small" />
              <Avatar name="Maya Chen" color="rose" size="small" />
              <Avatar name="Alex Morgan" color="cyan" size="small" />
            </span>
            <span>Fictional teammates. Real interaction patterns.</span>
          </div>
        </div>
        <div>
          <p className="eyebrow">THE PEOPLE BEHIND THE PROGRESS</p>
          <h2>
            Great work is
            <br />a team sport.
          </h2>
          <p>
            Give people a shared view of projects, a clear place for feedback, and a little less
            noise. Keep internal notes separate from client-facing updates in the preview UI.
          </p>
          <Link className="text-link" to="/w/studio/team">
            Meet the sample team
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className="public-section support-showcase">
        <div>
          <LifeBuoy size={30} />
          <p className="eyebrow">A CLEARER LINE TO YOUR CLIENTS</p>
          <h2>
            Good support feels
            <br />
            like a conversation.
          </h2>
          <p>
            From first question to thoughtful reply, keep context close and the next step clear.
            Explore the support inbox and the simpler client portal.
          </p>
          <Button asChild>
            <Link to="/w/studio/tickets">
              Explore support
              <ArrowUpRight size={15} />
            </Link>
          </Button>
        </div>
        <div className="marketing-ticket">
          <div>
            <Badge tone="amber">#1042 · Sample request</Badge>
            <Badge tone="violet">Open</Badge>
          </div>
          <h3>Review the updated dashboard navigation</h3>
          <p>“Could we make the reporting section easier for new users to find?”</p>
          <div className="person-row">
            <Avatar name="Riley Park" color="green" />
            <span>
              <strong>Riley, Orbit</strong>
              <small>Fictional client contact</small>
            </span>
          </div>
          <div className="mini-ticket-reply">
            <Check size={16} />
            <span>Clear ownership. A considered response.</span>
            <ArrowRight size={14} />
          </div>
        </div>
      </section>
      <section className="public-section pricing-preview">
        <div>
          <p className="eyebrow">START SIMPLE. MAKE ROOM TO GROW.</p>
          <h2>
            A workspace for
            <br />
            your next chapter.
          </h2>
          <p>
            Starter, Growth, and Business — explore an illustrative plan structure. Pricing and
            limits are examples, with no checkout or paid subscription.
          </p>
        </div>
        <Button asChild variant="primary">
          <Link to="/pricing">
            Explore illustrative plans
            <ArrowUpRight size={16} />
          </Link>
        </Button>
      </section>
      <section className="public-section faq-section">
        <div>
          <p className="eyebrow">A LITTLE MORE CLARITY</p>
          <h2>
            Good questions.
            <br />
            Straight answers.
          </h2>
        </div>
        <div>
          {[
            {
              question: 'Is this a working product?',
              answer:
                'This is a working frontend demo. You can create and edit local projects, tasks, clients, and support conversations. The backend and production services are not implemented.',
            },
            {
              question: 'Will my changes be saved?',
              answer:
                'Demo records live in browser memory and reset on refresh. Only theme and sidebar preferences are saved locally.',
            },
            {
              question: 'Is FlowAI connected to an AI model?',
              answer:
                'No. The assistant shows labeled scripted examples. No prompt or document is sent to an AI provider.',
            },
            {
              question: 'Can I invite my real team or pay for a plan?',
              answer:
                'Not yet. Invitations and pricing are previews. No email is sent, no secure account is created, and no payment is processed.',
            },
            {
              question: 'Who is FlowWork AI designed for?',
              answer:
                'The intended audience is software development and digital marketing agencies, with room to explore workflows for service businesses and growing teams. Customer demand is still being validated.',
            },
          ].map((q) => (
            <details key={q.question}>
              <summary>
                {q.question}
                <PlusSign />
              </summary>
              <p>{q.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="public-section final-cta">
        <span className="final-cta-mark">
          <Sparkles size={27} />
        </span>
        <p className="eyebrow">A LITTLE CLARITY CHANGES THE DAY.</p>
        <h2>
          Make room for
          <br />
          your best work.
        </h2>
        <p>Take a look around. Find your next step.</p>
        <Button asChild variant="primary">
          <Link to="/w/studio/dashboard">
            Explore Demo Workspace
            <MoveRight size={17} />
          </Link>
        </Button>
        <small>No signup. No live services. Just a thoughtful preview.</small>
      </section>
    </>
  )
}
function PlusSign() {
  return (
    <span className="faq-plus" aria-hidden="true">
      +
    </span>
  )
}
export function FeaturesPage() {
  return (
    <>
      <section className="public-section features-hero">
        <Badge tone="violet">THE PRODUCT, IN PERSPECTIVE</Badge>
        <h1>
          Less scattered.
          <br />
          <span>More in flow.</span>
        </h1>
        <p className="hero-subtitle">
          Projects, people, and the context between them.
          <br />
          Explore how the frontend brings agency work together.
        </p>
        <Button asChild variant="primary">
          <Link to="/w/studio/dashboard">
            Explore the workspace
            <ArrowUpRight size={16} />
          </Link>
        </Button>
      </section>
      <section className="public-section">
        <div className="marketing-feature-grid">
          {[
            ...features,
            {
              Icon: Sparkles,
              label: 'FlowAI',
              title: 'A little help with the bigger picture.',
              text: 'Scripted examples of summaries, drafts, and source references. No live AI.',
              path: 'ai',
              tone: 'violet',
            },
            {
              Icon: BookOpen,
              label: 'Knowledge',
              title: 'Keep the context close.',
              text: 'Sample briefs, playbooks, and local text search. Real uploads and RAG come later.',
              path: 'knowledge',
              tone: 'cyan',
            },
          ].map(({ Icon, label, title, text, path, tone }) => (
            <article key={label}>
              <span className={`feature-icon avatar-${tone}`}>
                <Icon size={24} />
              </span>
              <p className="eyebrow">{label}</p>
              <h2>{title}</h2>
              <p>{text}</p>
              <Link to={`/w/studio/${path}`}>
                Open demo
                <ArrowUpRight size={15} />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="public-section">
        <MarketingPreview />
      </section>
      <section className="public-section feature-transparency">
        <ShieldCheck size={24} />
        <div>
          <h2>A preview with clear boundaries.</h2>
          <p>
            All companies, people, and records are fictional. Interactions stay in browser memory.
            Authentication, server permissions, storage, payments, email, live AI, and real-time
            delivery are unavailable. The client portal is a presentation preview and provides no
            security boundary.
          </p>
        </div>
        <Button asChild>
          <Link to="/login">
            Explore account UI
            <ArrowUpRight size={15} />
          </Link>
        </Button>
      </section>
    </>
  )
}
