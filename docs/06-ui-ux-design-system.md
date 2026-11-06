# 06 · Premium UI/UX design system

Status: implementation blueprint only. No screens, components, styles or assets have been built.

## Brand and visual direction

**FlowWork AI** · *One Workspace. Every Workflow. Powered by AI.*

An original, quiet B2B interface influenced by the information clarity of Linear and Notion: restrained surfaces, readable typography, compact but comfortable rows, deliberate whitespace and one primary action per context. Avoid decorative dashboard charts without a decision to support. Dark mode is default; light mode follows a saved account preference or system preference after first use. Client portal keeps the same primitives with simpler navigation.

## Semantic color tokens

| Token | Dark | Light | Usage |
|---|---|---|---|
| background | #0B1020 | #F8FAFC | Main canvas |
| surface | #151D30 | #FFFFFF | Panels, navigation |
| surface-raised | #202B43 | #F1F5F9 | Dialogs, hovered rows |
| text-primary | #F8FAFC | #0F172A | Body and headings |
| text-muted | #B8C3D9 | #475569 | Secondary labels |
| border-subtle | #334155 | #CBD5E1 | Decorative separators |
| border-control | #64748B | #64748B | Visible input/control edges; check adjacent contrast |
| primary | #6366F1 | #4F46E5 | Brand accents; large decoration |
| primary-action | #4F46E5 | #4338CA | Filled primary button with #FFFFFF label |
| accent | #22D3EE | #0E7490 | Focus/selected accent; dark text on cyan fills |
| success-text | #86EFAC | #166534 | Success with icon/text |
| warning-text | #FDE68A | #854D0E | Warnings with icon/text |
| danger-text | #FDA4AF | #9F1239 | Errors/destructive labels |
| danger-action | #BE123C | #BE123C | Destructive filled button with white label |

Brand primary is not automatically an accessible small-text foreground on every surface. Semantic action token intentionally darkens it for white labels. Require measured ≥4.5:1 normal text, ≥3:1 large text and necessary non-text boundaries/focus indicators; do not assume every token pairing passes. Cyan fill uses #0B1020 text. Disabled states must remain understandable and expose why an action is unavailable. Never convey state solely through hue.

Phase 1 sRGB contrast calculations for selected opaque pairs: light text on dark surface 16.05:1; muted text on dark surface 9.47:1; white on dark primary-action 6.29:1; white on light primary-action 7.90:1; background-colored text on cyan 10.48:1. These numeric checks do not validate actual components, alpha overlays, focus states or the whole palette; rendered accessibility review remains a Phase 2 gate.

## Typography, spacing and shape

Prefer locally served Geist, with Inter as an alternative and system sans-serif fallback. Choose one font family in Phase 2 after license/asset review; do not load both unnecessarily. Body 14 px/22 px; helper 12/18 (not for primary reading); navigation 14/20 medium; page title 28/36 semibold; section 20/28; panel 16/24; landing headline 48/56 desktop and 32/40 mobile. Numeric analytics use tabular figures. Keep prose line length 60–75 characters; no all-caps paragraphs.

Spacing base 4 px: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Form field gaps 16, section gaps 32, panel padding 20 desktop/16 mobile. Radius 6 px small controls, 8 inputs/buttons, 12 panels/dialogs, full avatars/status dots. Border 1 px; focus ring 2 px with 2 px offset. Dark surfaces rely on borders and tonal steps, with modest shadow only for overlays. Elevation layers: base 0, sticky 10, dropdown 30, drawer 40, modal/backdrop 50/49, toast 60. Tooltips do not cover important actions and must work in modal stacking contexts.

Lucide icons: 16 px dense inline, 20 px controls, stroke 1.75–2; consistent accessible labels for icon-only actions, decorative icons aria-hidden. No mixed icon libraries. Animation 120–180 ms hover/fade, 200 ms drawer; transform/opacity only where practical. Respect reduced motion; no essential information delivered only by animation.

## Layout and responsive rules

Breakpoints: mobile <640 px, wide mobile 640–767, tablet 768–1023, desktop 1024–1279, large ≥1280. Desktop shell: 240 px sidebar, 64 px topbar, content max 1440 px with 24–32 px gutters; 12-column grid, 24 px gap. Tablet collapses sidebar to 72 px labeled-on-demand rail or drawer, 8 columns and 20 px gutters. Mobile uses topbar + navigation drawer, 4 columns and 16 px gutters; essential actions stay reachable without horizontal page scrolling. Tables can horizontally scroll within a labeled region or become record cards. Board alone may scroll horizontally, with column selection/list alternative on mobile. Sticky controls must not obscure keyboard focus.

## Component contracts

All components use typed props, semantic HTML, shared Tailwind tokens and Radix/shadcn primitives where applicable. States include default, hover, focus-visible, pressed/selected, disabled, busy, invalid and success where relevant. Busy controls retain width and announce progress; prevent double submit. Permission absence usually removes an action; entitlement-disabled actions explain a permitted upgrade path only to eligible roles.

| Component | Variants and required behavior |
|---|---|
| Button | primary/secondary/ghost/destructive, 32/40/44 px sizes; mobile target ≥44 px; text labels for consequential actions |
| Input | visible label, helper/error association, autocomplete/inputMode, invalid aria state; passwords support reveal with accessible toggle |
| Select | native for simple/mobile where appropriate; combobox for searchable people/projects, keyboard selection and clear option |
| Modal/Dialog | named title/description, focus trap, initial safe action, Escape except unavoidable critical flow, restore trigger focus |
| Drawer | task details/mobile filters, same focus rules as dialog; deep-link URL and full-page fallback |
| Dropdown | action menu with keyboard arrows, separators and labeled destructive item; no nested menu maze |
| Tooltip | supplementary short text only, accessible hover/focus, never sole source of label/error |
| Badge | text+optional icon; statuses use stable names, not only color; noninteractive unless explicit button |
| Table | semantic headers, caption, sort aria-sort, row actions reachable by keyboard, paginated; no click-only rows |
| Tabs | arrow navigation, linked panel IDs, sensible activation; URL tracks major project tabs |
| Skeleton | approximate content geometry, aria-hidden; surrounding region aria-busy; no indefinite shimmer under reduced motion |
| Toast | brief success/status with polite live region; actionable errors stay inline too; dismiss and sufficient duration |
| Avatar | initials fallback, meaningful alt only if image conveys identity beyond adjacent name; no public private-image URLs |
| Breadcrumb | labeled nav, current page aria-current, collapse middle entries on small screens |
| Sidebar | workspace identity, grouped links, clear current route, collapsible preference; Client-specific navigation |
| Topbar | breadcrumb, search, notifications and account; workspace switch always visible |
| Command/search | Ctrl/Cmd+K optional shortcut; labeled dialog, keyboard results, permission-scoped search, no global client leakage |
| Empty state | distinguish no records from filtered-out results and no permission; one relevant action if allowed |
| Error state | concise action, retry if safe, requestId for support; no raw exception or lost form fields |
| Confirmation dialog | exact affected resource, impact and safe cancel; typed slug for workspace deletion, recent reauth handled explicitly |
| Pagination | next/previous cursor, page size, loading status, no fabricated total count |

## Accessibility and content

WCAG 2.2 AA is the acceptance target, not a certification. Provide skip-to-content, landmarks, ordered headings, visible focus, non-drag Kanban controls, accessible names, field-level and form-summary errors, 200% zoom/reflow and screen-reader announcements for async saves. Minimum WCAG target dimensions are assessed; product defaults to 44 px mobile targets. Test keyboard-only and NVDA/browser combinations plus automated Playwright accessibility checks. Avoid stealing focus on background notification or refresh.

Show absolute dates with workspace timezone and locale; task deadlines without time should be represented consistently as date-only inputs with a documented backend conversion, or explicitly timestamped. MVP chooses timestamp deadlines with timezone shown; never silently reinterpret a user's date. Relative “2 hours ago” text has an absolute timestamp available. AI content is visibly labeled as assistance, citations remain accessible, and unsupported answers say evidence is insufficient. Use plain copy, no invented testimonials, customer logos, savings claims or fabricated activity on public pages.

See document 07 for page-level data/state behavior. Use shared primitives for every page; per-page styling does not redefine spacing, colors or status semantics.
