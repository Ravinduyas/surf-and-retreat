// The user manual, inside the system.
//
// A PDF nobody opens is not documentation. This lives where the work happens,
// searches, and links straight into the screen it is describing — so reading
// about the night audit puts you one click from running it.
//
// The writing is in `manual/content.tsx` and the pictures are in
// `manual/diagrams.tsx`; this file is only the shell that finds and shows them.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ArrowUpRight, BookOpen, ChevronRight } from 'lucide-react';
import { MANUAL, ALL_TOPICS, type Task, type Topic } from '../manual/content';
import { Card, Button, SectionHeader, TextInput } from '../ui';
import { useNav } from '../nav';
import type { ScreenName } from '../types';

export function ManualScreen() {
  const { navigate } = useNav();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string>(ALL_TOPICS[0]?.id ?? '');
  const bodyRef = useRef<HTMLDivElement>(null);

  /**
   * Search over titles, summaries and keywords — not the body.
   *
   * Searching the body would mean flattening React elements to text on every
   * keystroke, and it would rank a topic that mentions "deposit" once above the
   * topic that is *about* deposits. Keywords carry the words somebody would
   * actually type that are not already in a title.
   */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const words = q.split(/\s+/);
    return ALL_TOPICS
      .map((t) => {
        const hay = `${t.title} ${t.summary} ${t.section} ${(t.keywords ?? []).join(' ')}`.toLowerCase();
        const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
        return { topic: t, score };
      })
      .filter((r) => r.score === words.length)
      .map((r) => r.topic);
  }, [query]);

  const open: (Topic & { section?: string }) | undefined =
    ALL_TOPICS.find((t) => t.id === openId) ?? ALL_TOPICS[0];

  // Scroll the reading pane, not the window: the contents list stays put so you
  // can work down it without scrolling back up each time.
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [openId]);

  // Deep link, so a "read about this" link elsewhere can land on a topic.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('topic');
    if (wanted && ALL_TOPICS.some((t) => t.id === wanted)) setOpenId(wanted);
  }, []);

  return (
    <div>
      <SectionHeader
        eyebrow="Help"
        title="User manual"
        action={
          <div className="w-full sm:w-[280px] relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-dash-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the manual…"
              className="w-full bg-white border border-black/10 rounded-xl pl-9 pr-8 py-2.5
                         text-[13px] focus:border-black/40 transition-colors"
            />
            {query && (
              <button onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dash-muted hover:text-black">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        }
      />

      {results ? (
        <Card>
          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
            {results.length === 0 ? 'Nothing found' : `${results.length} result${results.length === 1 ? '' : 's'}`}
          </p>
          {results.length === 0 ? (
            <p className="text-[13px] text-dash-muted">
              Try a word from what you are trying to do — &ldquo;deposit&rdquo;,
              &ldquo;overbooking&rdquo;, &ldquo;night audit&rdquo;, &ldquo;dorm&rdquo;.
            </p>
          ) : (
            <div className="space-y-1">
              {results.map((t) => (
                <button key={t.id}
                  onClick={() => { setOpenId(t.id); setQuery(''); }}
                  className="w-full text-left p-3 rounded-xl hover:bg-black/[.04] transition-colors">
                  <p className="text-[10px] uppercase tracking-widest text-dash-muted">{t.section}</p>
                  <p className="text-[13px] font-bold">{t.title}</p>
                  <p className="text-[12px] text-dash-muted">{t.summary}</p>
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[260px_1fr] gap-3 items-start">
          {/* ── contents ── */}
          <Card padded={false} className="p-3 lg:sticky lg:top-3 max-h-[calc(100dvh-7rem)] overflow-y-auto">
            {MANUAL.map((section) => (
              <div key={section.id} className="mb-4 last:mb-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted px-2 mb-1.5">
                  {section.title}
                </p>
                {section.topics.map((t) => (
                  <button key={t.id}
                    onClick={() => setOpenId(t.id)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-[12px] leading-snug
                                transition-colors flex items-start gap-1.5 ${
                      openId === t.id
                        ? 'bg-black text-white font-bold'
                        : 'hover:bg-black/[.05] text-dash-ink'}`}>
                    <ChevronRight className={`w-3 h-3 mt-0.5 shrink-0 ${
                      openId === t.id ? 'opacity-70' : 'opacity-0'}`} />
                    {t.title}
                  </button>
                ))}
              </div>
            ))}
          </Card>

          {/* ── the topic ── */}
          <Card>
            <div ref={bodyRef} className="max-w-3xl">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                    {(open as any)?.section}
                  </p>
                  <h2 className="text-[20px] font-bold tracking-tight">{open?.title}</h2>
                </div>
                {open?.screen && (
                  <Button variant="secondary" size="sm"
                    icon={<ArrowUpRight className="w-3.5 h-3.5" />}
                    onClick={() => navigate(open.screen as ScreenName)}>
                    Open this screen
                  </Button>
                )}
              </div>
              <p className="text-[13px] text-dash-muted mb-5">{open?.summary}</p>

              {open?.body}

              {open?.tasks?.length ? (
                <div className="mt-6 pt-5 border-t border-black/10">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-dash-muted" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                      How to
                    </p>
                  </div>
                  <div className="space-y-4">
                    {open.tasks.map((task) => <TaskBlock key={task.title} task={task} />)}
                  </div>
                </div>
              ) : null}

              <Neighbours currentId={open?.id ?? ''} onGo={setOpenId} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function TaskBlock({ task }: { task: Task }) {
  return (
    <div className="rounded-task border border-black/10 p-4">
      <p className="text-[13px] font-bold mb-2">{task.title}</p>
      <ol className="space-y-1.5">
        {task.steps.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-[12px] leading-relaxed">
            <span className="w-4 h-4 shrink-0 rounded-full bg-black/[.06] text-[9px] font-bold
                             flex items-center justify-center mt-0.5">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {task.warning && (
        <p className="text-[12px] leading-relaxed mt-3 pt-3 border-t border-black/5 text-status-warn">
          {task.warning}
        </p>
      )}
    </div>
  );
}

/** Previous and next, so the manual can simply be read through. */
function Neighbours({ currentId, onGo }: { currentId: string; onGo: (id: string) => void }) {
  const i = ALL_TOPICS.findIndex((t) => t.id === currentId);
  const prev = i > 0 ? ALL_TOPICS[i - 1] : null;
  const next = i >= 0 && i < ALL_TOPICS.length - 1 ? ALL_TOPICS[i + 1] : null;
  if (!prev && !next) return null;
  return (
    <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-black/10">
      {prev ? (
        <button onClick={() => onGo(prev.id)} className="text-left group max-w-[45%]">
          <p className="text-[10px] uppercase tracking-widest text-dash-muted">Previous</p>
          <p className="text-[12px] font-bold group-hover:underline truncate">{prev.title}</p>
        </button>
      ) : <span />}
      {next && (
        <button onClick={() => onGo(next.id)} className="text-right group max-w-[45%] ml-auto">
          <p className="text-[10px] uppercase tracking-widest text-dash-muted">Next</p>
          <p className="text-[12px] font-bold group-hover:underline truncate">{next.title}</p>
        </button>
      )}
    </div>
  );
}
