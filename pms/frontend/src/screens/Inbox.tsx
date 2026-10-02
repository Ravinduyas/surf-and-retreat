// The unified guest inbox: every conversation across every channel, with the
// booking beside the thread.
//
// The reason this screen exists is that answering a Booking.com guest should
// not mean logging in to Booking.com. The reason it is careful is that not
// every channel can carry a reply — so the compose box says what will happen to
// what you type *before* you type it, and a message that did not get through is
// shown on the thread as failed rather than quietly dropped.
import { useState } from 'react';
import {
  Inbox as InboxIcon, Send, RefreshCw, TriangleAlert, MessageSquare, Check,
  CircleAlert, FileText, Search,
} from 'lucide-react';
import { useNav } from '../nav';
import {
  useInbox, useThread, useSendGuestMessage, useRetryMessage, useMarkThreadRead,
  usePollMessages, useMessageTemplates,
  type InboxThread, type ThreadMessage,
} from '../queries';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Tabs, Select, TextInput } from '../ui';
import { QueryState, useToast, PermissionButton, WarnNote, InfoNote } from '../components';
import { shortDate, timestamp, relativeTime } from '../format';
import { CHANNEL_HUB } from '../branding';

const CHANNELS_CAVEAT =
  `Which channels relay guest messages is set from the documented ${CHANNEL_HUB} integrations and has not `
  + 'been confirmed against a live account. A reply is never shown as delivered — only as accepted '
  + 'by the channel.';

export function InboxScreen() {
  const { navigate } = useNav();
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const today = property?.businessDate ?? new Date().toISOString().slice(0, 10);

  const [filter, setFilter] = useState<'all' | 'unread' | 'inHouse' | 'arriving'>('all');
  const [channelCode, setChannelCode] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filters: Record<string, string> = {};
  if (filter === 'unread') filters.unread = '1';
  if (filter === 'inHouse') filters.inHouse = '1';
  if (filter === 'arriving') filters.arriving = '1';
  if (channelCode) filters.channelCode = channelCode;
  if (search.trim()) filters.search = search.trim();

  const inbox = useInbox(filters);
  const poll = usePollMessages();

  return (
    <div>
      <SectionHeader
        eyebrow="Guest communication"
        title="Inbox"
        action={
          <PermissionButton permission="profiles.write" variant="secondary"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            disabled={poll.isPending}
            onClick={async () => {
              try {
                const r: any = await poll.mutateAsync();
                if (r.errors?.length && !r.imported) {
                  toast.push({ kind: 'warn', title: 'Nothing new', body: r.errors[0] });
                } else {
                  toast.success(
                    r.imported ? `${r.imported} new message(s)` : 'No new messages',
                    `${r.polled} conversation(s) checked`);
                }
              } catch (e) { toast.fail(e, 'Could not check for messages'); }
            }}>
            {poll.isPending ? 'Checking…' : 'Check now'}
          </PermissionButton>
        }
      />

      <QueryState query={inbox} loadingRows={5}>
        {(data) => {
          const uncarried = data.channels.filter((c) => c.connected && !c.carriesMessages);
          return (
            <>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Tabs
                  tabs={[
                    { value: 'all', label: 'All', count: data.threads.length },
                    { value: 'unread', label: 'Unread', count: data.unread || undefined },
                    { value: 'inHouse', label: 'In-house' },
                    { value: 'arriving', label: 'Arriving today' },
                  ]}
                  active={filter}
                  onChange={setFilter}
                />
                <div className="w-full sm:w-[180px]">
                  <Select value={channelCode} onChange={setChannelCode} options={[
                    { label: 'All channels', value: '' },
                    ...data.channels.map((c) => ({
                      label: c.carriesMessages ? c.name : `${c.name} (no messaging)`,
                      value: c.code,
                    })),
                  ]} />
                </div>
                <div className="flex-1 min-w-[180px] relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-dash-muted" />
                  <TextInput value={search} onChange={setSearch}
                    placeholder="Guest, booking or words in a message" className="pl-9" />
                </div>
              </div>

              {uncarried.length > 0 && (
                <div className="mb-3">
                  <InfoNote>
                    {uncarried.map((c) => c.name).join(', ')}{' '}
                    {uncarried.length === 1 ? 'does' : 'do'} not relay guest messages through {CHANNEL_HUB}.
                    Conversations on {uncarried.length === 1 ? 'that channel' : 'those channels'} have
                    to be answered by email or phone — replies typed here stay as internal notes.
                  </InfoNote>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-3">
                <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto scroll-thin pr-1">
                  {data.threads.length === 0 ? (
                    <Card>
                      <div className="py-10 text-center">
                        <InboxIcon className="w-6 h-6 text-dash-muted mx-auto mb-2" />
                        <p className="text-[13px] font-bold">No conversations</p>
                        <p className="text-[11px] text-dash-muted mt-1">
                          Guest messages from connected channels appear here.
                        </p>
                      </div>
                    </Card>
                  ) : data.threads.map((t) => (
                    <ThreadRow key={t.reservationId} thread={t}
                      active={openId === t.reservationId}
                      onOpen={() => setOpenId(t.reservationId)} />
                  ))}
                </div>

                <div>
                  {openId
                    ? <Conversation reservationId={openId} today={today}
                        thread={data.threads.find((t) => t.reservationId === openId)}
                        onOpenBooking={(rid) => navigate('guest-dashboard', { reservationId: rid })} />
                    : (
                      <Card>
                        <div className="py-16 text-center">
                          <MessageSquare className="w-6 h-6 text-dash-muted mx-auto mb-2" />
                          <p className="text-[13px] font-bold">Pick a conversation</p>
                          <p className="text-[11px] text-dash-muted mt-1 max-w-sm mx-auto leading-relaxed">
                            {CHANNELS_CAVEAT}
                          </p>
                        </div>
                      </Card>
                    )}
                </div>
              </div>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

function ThreadRow({ thread, active, onOpen }: {
  thread: InboxThread; active: boolean; onOpen: () => void;
}) {
  return (
    <button onClick={onOpen}
      className={`w-full text-left rounded-2xl border p-3 transition-colors ${
        active ? 'border-black/40 bg-white' : 'border-black/5 bg-white hover:border-black/20'}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-bold truncate">{thread.guest}</span>
            {thread.unread > 0 && <Pill tone="red" solid>{thread.unread}</Pill>}
            {thread.failed > 0 && <Pill tone="red">{thread.failed} failed</Pill>}
          </div>
          <p className="text-[10px] text-dash-muted">
            {thread.confirmation}
            {thread.channelCode && ` · ${thread.channelCode}`}
            {thread.room && ` · room ${thread.room}`}
          </p>
        </div>
        <span className="text-[10px] text-dash-muted whitespace-nowrap shrink-0">
          {relativeTime(thread.lastAt)}
        </span>
      </div>
      <p className={`text-[11px] line-clamp-2 ${thread.unread ? 'font-semibold' : 'text-dash-muted'}`}>
        {thread.lastDirection === 'out' && <span className="text-dash-muted">You: </span>}
        {thread.lastBody}
      </p>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {thread.inHouse && <Pill tone="mint">in-house</Pill>}
        {thread.arrivingToday && !thread.inHouse && <Pill tone="yellow">arriving today</Pill>}
        {!thread.canReplyViaChannel && <Pill tone="grey">no channel reply</Pill>}
      </div>
    </button>
  );
}

function Conversation({ reservationId, thread, today, onOpenBooking }: {
  reservationId: string;
  thread?: InboxThread;
  today: string;
  onOpenBooking: (reservationId: string) => void;
}) {
  const toast = useToast();
  const messages = useThread(reservationId);
  const send = useSendGuestMessage();
  const retry = useRetryMessage();
  const markRead = useMarkThreadRead();
  const templates = useMessageTemplates();
  const [body, setBody] = useState('');
  const [readFor, setReadFor] = useState<string | null>(null);

  // Opening a conversation is reading it.
  if (thread && thread.unread > 0 && readFor !== reservationId) {
    setReadFor(reservationId);
    markRead.mutate({ reservationId });
  }

  const canReply = thread?.canReplyViaChannel ?? false;

  return (
    <Card>
      {thread && (
        <div className="flex items-start justify-between gap-3 pb-3 mb-3 border-b subtle-divider flex-wrap">
          <div>
            <p className="text-[14px] font-bold">{thread.guest}</p>
            <p className="text-[11px] text-dash-muted">
              {thread.confirmation} · {thread.roomType}
              {thread.room && ` · room ${thread.room}`} ·{' '}
              {shortDate(thread.arrival)} → {shortDate(thread.departure)}
              {thread.otaReference && ` · ${thread.otaReference}`}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => onOpenBooking(reservationId)}>
            Open booking
          </Button>
        </div>
      )}

      <QueryState query={messages} loadingRows={3}>
        {(data) => (
          <div className="space-y-2 max-h-[46vh] overflow-y-auto scroll-thin mb-3">
            {data.messages.length === 0 && (
              <p className="text-[12px] text-dash-muted py-6 text-center">Nothing said yet.</p>
            )}
            {data.messages.map((m: ThreadMessage) => <Bubble key={m.id} message={m}
              onRetry={async () => {
                try {
                  const r: any = await retry.mutateAsync({ id: m.id });
                  if (r.status === 'accepted') toast.success('Sent');
                  else toast.push({ kind: 'error', title: 'Still refused', body: r.error });
                } catch (e) { toast.fail(e); }
              }} />)}
          </div>
        )}
      </QueryState>

      {!canReply && thread && (
        <WarnNote>
          {thread.channelCode
            ? `${thread.channelCode} does not relay replies through ${CHANNEL_HUB}. Anything typed here is `
              + 'kept as an internal note — reach the guest by email or phone.'
            : 'This booking did not come from a channel, so there is nowhere to send a reply. '
              + 'Anything typed here is kept as an internal note.'}
        </WarnNote>
      )}

      <div className="mt-3 space-y-2">
        {(templates.data?.templates.length ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <FileText className="w-3 h-3 text-dash-muted" />
            {templates.data!.templates.filter((t) => t.active).map((t) => (
              <button key={t.id}
                className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-black/10 hover:border-black/40"
                onClick={() => setBody(t.body)}>
                {t.name}
              </button>
            ))}
          </div>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder={canReply ? 'Reply to the guest…' : 'Note (not sent to the guest)'}
          className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] focus:border-black/40 transition-colors"
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[10px] text-dash-muted flex items-start gap-1.5 max-w-xl leading-relaxed">
            <CircleAlert className="w-3 h-3 shrink-0 mt-px" />
            {CHANNELS_CAVEAT}
          </p>
          <PermissionButton permission="profiles.write"
            icon={<Send className="w-3.5 h-3.5" />}
            disabled={!body.trim() || send.isPending}
            onClick={async () => {
              try {
                const r: any = await send.mutateAsync({ reservationId, body });
                setBody('');
                if (r.status === 'accepted') {
                  toast.success('Sent to the guest', 'The channel accepted the message.');
                } else if (r.localOnly) {
                  toast.push({ kind: 'warn', title: 'Kept as a note', body: r.error });
                } else {
                  toast.push({ kind: 'error', title: 'The channel refused it', body: r.error });
                }
              } catch (e) { toast.fail(e, 'Could not send that'); }
            }}>
            {send.isPending ? 'Sending…' : canReply ? 'Send' : 'Keep as a note'}
          </PermissionButton>
        </div>
      </div>
      <span className="hidden">{today}</span>
    </Card>
  );
}

function Bubble({ message, onRetry }: { message: ThreadMessage; onRetry: () => void }) {
  const mine = message.direction === 'out';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
        mine ? 'bg-dash-text text-white' : 'bg-dash-bg'}`}>
        <p className="text-[12px] whitespace-pre-wrap leading-relaxed">{message.body}</p>
        <div className={`flex items-center gap-1.5 mt-1 text-[9px] ${
          mine ? 'text-white/60' : 'text-dash-muted'}`}>
          <span title={timestamp(message.ts)}>{relativeTime(message.ts)}</span>
          {message.author && <span>· {message.author}</span>}
          {mine && message.status === 'accepted' && (
            <span className="inline-flex items-center gap-0.5">
              · <Check className="w-2.5 h-2.5" />accepted by {message.channelCode ?? 'the channel'}
            </span>
          )}
          {mine && message.status === 'draft' && <span>· not sent</span>}
          {mine && message.status === 'queued' && <span>· sending…</span>}
        </div>
        {message.status === 'failed' && (
          <div className="mt-1.5 pt-1.5 border-t border-white/20">
            <p className="text-[10px] text-status-bad flex items-start gap-1">
              <TriangleAlert className="w-3 h-3 shrink-0 mt-px" />
              Not delivered — {message.error}
            </p>
            <button onClick={onRetry}
              className="text-[10px] font-bold underline mt-1">
              Try again{message.attempts > 1 ? ` (${message.attempts} attempts)` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
