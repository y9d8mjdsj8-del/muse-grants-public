import assert from 'node:assert/strict';
import { DEFAULT_KEYWORDS, dedupeKey, titleKey, type Notice, type Entity } from '@muse/core';
import { selectDigest, renderDigest } from '../src/digest';
const now = new Date('2026-10-21T23:17:00Z'); // Oct 22 in Korea
const notice: Notice = {id:'a',kind:'grant',title:'뷰티 수출바우처 지원',org:'기관',sources:[],url:'https://example.com/a',fields:[],tags:[],deadline:'2026-10-29',checkedAt:'2026-10-22'};
const entity: Entity = {id:'business',name:'Example',short:'Example',type:'개인사업자',region:'서울',documents:[],profile:{genres:['뷰티','수출바우처']}};
const select = (states:any[]=[],sent=new Set<string>(),n=notice) => selectDigest([n],states,[entity],DEFAULT_KEYWORDS,new Set(['a']),sent,now);
assert.equal(select().fresh.length,1);
assert.equal(select([{notice_id:'a',hidden:true}]).events.length,0);
assert.equal(select([{notice_id:'other',deleted:true,title_key:titleKey(notice)}]).events.length,0);
assert.equal(select([],new Set([`new:${dedupeKey(notice)}`])).events.length,0);
for (const [date,expected] of [['2026-10-29',1],['2026-10-25',1],['2026-10-23',1],['2026-10-24',0]] as const) {
  assert.equal(select([{notice_id:'a',starred:true}],new Set(),{...notice,deadline:date}).reminders.length,expected);
}
const due = select([{notice_id:'a',starred:true}]);
assert.equal(due.fresh.length,0); // don't show one notice twice in one email
assert.equal(select([{notice_id:'a',starred:true}],new Set(due.events)).reminders.length,0);
assert.equal(select([],new Set(),{...notice,deadline:'2026-10-21'}).events.length,0);
assert.equal(selectDigest([notice],[],[entity],DEFAULT_KEYWORDS,new Set(),new Set(),now).events.length,0);
const malicious = {...notice,title:'뷰티 <img src=x onerror=alert(1)>',url:'javascript:alert(1)'};
const rendered = renderDigest(select([],new Set(),malicious),'https://example.com','2026-10-22');
assert.ok(!rendered.html.includes('<img'));
assert.ok(!rendered.html.includes('javascript:'));
assert.ok(rendered.subject.startsWith('[지원사업] MUSE Grants'));
console.log('Digest tests passed: Korea dates, new-only, reminders, dedupe, hidden/deleted, empty, HTML escaping.');
