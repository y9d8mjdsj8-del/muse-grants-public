import { daysLeft, koreaCalendarDate, recommendNotices, titleKey, dedupeKey, type Notice, type Entity, type KeywordSet } from '@muse/core';

export interface State { notice_id: string; starred?: boolean; hidden?: boolean; deleted?: boolean; title_key?: string; decision?: string }
export function selectDigest(notices: Notice[], states: State[], entities: Entity[], keywords: KeywordSet, newIds: Set<string>, sentEvents: Set<string>, now: Date) {
  const byId = new Map(states.map(s => [s.notice_id, s]));
  const deleted = new Set(states.filter(s => s.deleted && s.title_key).map(s => s.title_key));
  const visible = notices.filter(n => { const s = byId.get(n.id); return !s?.hidden && !s?.deleted && s?.decision !== '비추' && !deleted.has(titleKey(n)); });
  const reminders = visible.flatMap(n => {
    const days = daysLeft(n.deadline, koreaCalendarDate(now));
    if (!byId.get(n.id)?.starred || days === null || ![7,3,1].includes(days)) return [];
    const event = `due:${dedupeKey(n)}:${n.deadline}:${days}`;
    return sentEvents.has(event) ? [] : [{ notice: n, days, event }];
  });
  const dueIds = new Set(reminders.map(r => r.notice.id));
  const fresh = recommendNotices(visible.filter(n => newIds.has(n.id)), entities, keywords, now)
    .filter(r => !sentEvents.has(`new:${dedupeKey(r.notice)}`) && !dueIds.has(r.notice.id));
  return { fresh, reminders, events: [...fresh.map(r => `new:${dedupeKey(r.notice)}`), ...reminders.map(r => r.event)] };
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderDigest(selection: ReturnType<typeof selectDigest>, site: string, day: string) {
  const base = new URL(site);
  if (base.protocol !== 'https:') throw new Error('DIGEST_SITE_URL must use HTTPS');
  const item = (n: Notice, detail: string) => {
    let link = base.href;
    try { const u = new URL(n.url); if (['https:', 'http:'].includes(u.protocol)) link = u.href; } catch { /* show dashboard */ }
    return `<li><a href="${escape(link)}">${escape(n.title)}</a><br>${escape(detail)}</li>`;
  };
  const html = `<h2>MUSE Grants · ${escape(day)}</h2>`
    + (selection.reminders.length ? `<h3>저장한 공고 마감 알림 (${selection.reminders.length}건)</h3><ul>${selection.reminders.map(r => item(r.notice, `마감 ${r.days}일 전 · ${r.notice.deadline}`)).join('')}</ul>` : '')
    + (selection.fresh.length ? `<h3>새 맞춤 공고 (${selection.fresh.length}건)</h3><ul>${selection.fresh.slice(0,5).map(r => item(r.notice, `${r.reasons.join(' / ')} · ${r.notice.deadline ?? '마감 확인 필요'} · 확인: ${r.checks.join(' / ')}`)).join('')}</ul>${selection.fresh.length > 5 ? '<p>상위 5건을 담았습니다. 나머지는 사이트에서 확인하세요.</p>' : ''}` : '')
    + `<p><a href="${escape(base.href)}">전체 공고 보기</a></p><p>추천은 신청 자격 확정이 아닙니다. 원문 요건과 마감 시간을 확인하세요.</p><p>하루 최대 한 통, 새 추천이나 마감 알림이 없으면 보내지 않습니다. 중지는 GitHub의 ‘지원사업 이메일’ 작업을 비활성화하세요.</p>`;
  return { subject: `[지원사업] MUSE Grants · 새 공고 ${selection.fresh.length}건 · 마감 ${selection.reminders.length}건 · ${day}`, html };
}
