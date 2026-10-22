import { createClient } from '@supabase/supabase-js';
import { DEFAULT_KEYWORDS, koreaCalendarDate, todayISO, type Notice } from '@muse/core';
import { selectDigest, renderDigest } from './digest';

const required = (name: string) => { const v = process.env[name]?.trim(); if (!v) throw new Error(`Missing ${name}`); return v; };
const checked = <T>(r: { data: T; error: unknown }, label: string): T => { if (r.error) throw new Error(`Database operation failed: ${label}`); return r.data; };
async function main() {
  const to = required('DIGEST_TO');
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) throw new Error('DIGEST_TO must be one email address');
  const from = required('DIGEST_FROM');
  const key = required('RESEND_API_KEY');
  // Explicit test delivery never reads profiles or advances the digest cursor.
  if (process.argv.includes('--test')) {
    if (process.argv.includes('--dry')) { console.log('Test configuration valid; no email sent.'); return; }
    const response = await fetch('https://api.resend.com/emails', {
      method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',
        'Idempotency-Key':`muse-connection-test/${todayISO(koreaCalendarDate())}`},
      body:JSON.stringify({from,to:[to],subject:'[지원사업] MUSE Grants · 이메일 연결 테스트',
        html:'<h2>MUSE Grants 이메일 연결 테스트</h2><p>이 메일은 서버 발송 연결 확인용입니다.</p><p>정기 알림은 별도 활성화 후 새 추천과 저장한 공고의 마감 알림을 하루 최대 한 통으로 보냅니다.</p>'}),
      signal:AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`Test email provider returned HTTP ${response.status}`);
    const result = await response.json() as {id?:string};
    if (!result.id) throw new Error('Provider did not return a test email ID.');
    console.log('Test email accepted by provider; confirm delivery in recipient mailbox.'); return;
  }
  const userId = required('DIGEST_USER_ID');
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid DIGEST_USER_ID');
  const db = createClient(new URL(required('SUPABASE_URL')).origin, required('SUPABASE_SERVICE_ROLE_KEY'), { db: { schema: 'grants' }, auth: { persistSession: false } });
  const now = new Date(); const cutoff = now.toISOString(); const day = todayISO(koreaCalendarDate(now));
  const dry = process.argv.includes('--dry');
  const all = async (table: string, query: (q: any) => any): Promise<any[]> => {
    const rows: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const page = checked<any[]>(await query(db.from(table).select('*')).range(offset, offset + 499), table);
      rows.push(...page); if (page.length < 500) return rows;
    }
  };
  const cursor = checked(await db.from('email_digest_cursor').select('*').eq('user_id',userId).maybeSingle(), 'cursor');
  if (!cursor) {
    if (!dry) checked(await db.from('email_digest_cursor').insert({user_id:userId,checked_at:cutoff}), 'initialize');
    console.log('Baseline initialized; existing notices will not be bulk-emailed.'); return;
  }
  const history = await all('email_digest_outbox', q => q.eq('user_id',userId).order('day'));
  // Stop ambiguous old deliveries instead of retrying beyond Resend's 24-hour dedupe window.
  if (history.some(r => !r.sent_at && now.getTime() - Date.parse(r.created_at) > 23*3600000)) throw new Error('Unresolved delivery older than 23 hours; reconcile provider status before resuming.');
  if (history.some(r => r.sent_at && todayISO(koreaCalendarDate(new Date(r.sent_at))) === day)) { console.log('Already sent today.'); return; }
  let pending = history.find(r => !r.sent_at);
  if (!pending) {
    const settings = checked(await db.from('user_settings').select('entities,keywords').eq('user_id',userId).single(), 'settings');
    if (!settings) throw new Error('Save site profile before enabling email.');
    const states = await all('user_notice_state', q => q.eq('user_id',userId).order('notice_id'));
    const analyses = await all('user_analyses', q => q.eq('user_id',userId).order('notice_id'));
    const analysis = new Map(analyses.map(r => [r.notice_id,r.analysis]));
    const rows = await all('notices', q => q.or(`created_by.is.null,created_by.eq.${userId}`).lte('created_at',cutoff).order('id'));
    const notices: Notice[] = rows.map(r => ({ id:r.id,kind:r.kind,title:r.title,org:r.org??'',sources:r.sources??[],url:r.url,region:r.region,fields:r.fields??[],tags:r.tags??[],overseas:r.overseas,deadline:r.deadline,deadlineLabel:r.deadline_label,summary:r.summary,checkedAt:r.checked_at,applyStart:r.details?.apply?.start,applyEnd:r.details?.apply?.end,grant:r.details?.grant,targets:r.details?.targets,analysis:analysis.get(r.id) }));
    const fresh = new Set<string>(rows.filter(r => r.created_at > cursor.checked_at).map(r => r.id));
    const sent = new Set<string>(history.filter(r => r.sent_at).flatMap(r => r.events));
    const selection = selectDigest(notices,states,settings.entities??[],settings.keywords??DEFAULT_KEYWORDS,fresh,sent,now);
    console.log(`Digest selected: ${selection.fresh.length} new, ${selection.reminders.length} deadline reminders.`);
    if (dry) return;
    if (!selection.events.length) { checked(await db.from('email_digest_cursor').update({checked_at:cutoff}).eq('user_id',userId),'empty cursor'); return; }
    const payload = {from,to:[to],...renderDigest(selection,required('DIGEST_SITE_URL'),day)};
    // Unique daily key + shared workflow concurrency prevents parallel sends.
    pending = checked(await db.from('email_digest_outbox').insert({user_id:userId,day,cutoff,payload,events:selection.events}).select().single(),'queue');
  }
  if (dry) { console.log('Pending delivery exists; dry run will not send.'); return; }
  const response = await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`muse-digest/${userId}/${pending.day}`},body:JSON.stringify(pending.payload),signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}; saved payload retained for safe retry.`);
  const result = await response.json() as {id?:string};
  if (!result.id) throw new Error('Provider did not return an email ID.');
  checked(await db.from('email_digest_outbox').update({sent_at:new Date().toISOString(),provider_id:result.id}).eq('user_id',userId).eq('day',pending.day),'mark sent');
  checked(await db.from('email_digest_cursor').update({checked_at:pending.cutoff}).eq('user_id',userId),'advance cursor');
  console.log('Email accepted by provider. Check recipient inbox for delivery.');
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Digest failed'); process.exitCode=1; });
