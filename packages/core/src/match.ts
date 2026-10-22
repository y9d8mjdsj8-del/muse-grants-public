import type { Entity, KeywordSet, Notice } from "./types";
import { daysLeft } from "./date";
import { businessTopics, TOPIC_LABELS } from "./classify";
import { noticePlace, residenceOf, SIGUNGU } from "./region";

/** 규칙 기반 매칭 점수 (0~100). 토큰 0. */
export function keywordScore(n: Notice, k: KeywordSet): number {
  const text = `${n.title} ${n.summary ?? ""} ${n.fields.join(" ")} ${n.tags.join(" ")}`;
  if (k.exclude.some((w) => w && text.includes(w))) return 0;
  const hits = k.include.filter((w) => w && text.includes(w)).length;
  const base = Math.min(100, hits * 25);
  const regionOk = !n.region || k.regions.length === 0 || k.regions.some((r) => n.region!.includes(r)) || n.region === "전국" || !!n.overseas;
  return regionOk ? base : Math.round(base * 0.3);
}

export function isOpen(n: Notice, now = new Date()): boolean {
  const d = daysLeft(n.deadline, now);
  return d === null || d >= 0;
}

export function fitTotal(n: Notice): number | undefined {
  const f = n.analysis?.fit;
  if (!f) return undefined;
  return f.eligibility + f.purpose + f.capacity + f.scale;
}

export function sortByDeadline(a: Notice, b: Notice, now = new Date()): number {
  const da = daysLeft(a.deadline, now);
  const db = daysLeft(b.deadline, now);
  const va = da === null ? 9999 : da < 0 ? 99999 : da;
  const vb = db === null ? 9999 : db < 0 ? 99999 : db;
  return va - vb;
}

/** 같은 공고 판별 키: 제목 정규화 + 기관 + 마감일 */
export function dedupeKey(n: Pick<Notice, "title" | "org" | "deadline">): string {
  const t = n.title.replace(/[\s()\[\]<>「」『』〈〉《》·,.:\-_'"]/g, "").toLowerCase();
  return `${t}|${n.org.replace(/\s/g, "")}|${n.deadline ?? ""}`;
}

/** 삭제 판별 키: 제목 정규화 + 기관 (마감일·연도 표기가 바뀌어 다시 올라와도 같은 공고로 봄) */
export function titleKey(n: Pick<Notice, "title" | "org">): string {
  const t = n.title.replace(/20\d\d년?도?/g, "").replace(/[\s()\[\]<>「」『』〈〉《》·,.:\-_'"]/g, "").toLowerCase();
  return `${t}|${n.org.replace(/\s|\(재\)/g, "")}`;
}

/** 영문 공고(해외 레지던시)용 한→영 동의어 */
const EN_SYN: Record<string, string[]> = {
  음악: ["music", "musician", "composer", "composition"],
  사운드: ["sound", "audio", "sonic", "acoustic"],
  미디어아트: ["media art", "new media", "digital art", "media arts"],
  공연: ["performance", "performing", "theatre", "theater", "dance"],
  다원예술: ["interdisciplinary", "multidisciplinary", "transdisciplinary"],
  융복합: ["interdisciplinary", "art and technology", "art & technology", "art-science", "art and science"],
  기술: ["technology", "tech", "science"],
  영상: ["film", "video", "moving image", "cinema"],
  전시: ["exhibition", "visual art", "visual arts"],
  창작: ["creation", "creative", "production"],
  레지던시: ["residency", "residence", "artist-in-residence"],
  해외: ["international"],
  국악: ["korean traditional music", "gugak"],
  미디어: ["media"],
  퍼포먼스: ["performance"],
  전자음악: ["electronic music", "electroacoustic", "electronics"],
};
/** 반대 방향 (영문 키워드 → 한글 본문) */
const KO_SYN: Record<string, string[]> = {};
for (const [ko, ens] of Object.entries(EN_SYN)) for (const en of ens) (KO_SYN[en] ??= []).push(ko);
Object.assign(KO_SYN, {
  music: [...(KO_SYN.music ?? []), "음악"], sound: ["사운드", "음향"], performance: ["공연", "퍼포먼스"], media: ["미디어"],
  "media art": ["미디어아트", "미디어 아트"], "new media": ["뉴미디어"], interdisciplinary: ["다원", "융복합"], electronic: ["전자음악", "일렉트로닉"],
  technology: ["기술", "테크"], dance: ["무용"], theatre: ["연극"], theater: ["연극"], exhibition: ["전시"], residency: ["레지던시", "레지던스"],
});
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 공고에 걸린 내 키워드 (제목·요약·분야·태그, 수집 때 검색한 키워드 kw:) */
export function matchedKeywords(n: Notice, keywords: string[]): string[] {
  const text = `${n.title} ${n.summary ?? ""} ${n.fields.join(" ")} ${n.org}`.toLowerCase();
  const searched = new Set(n.tags.filter((t) => t.startsWith("kw:")).map((t) => t.slice(3)));
  return keywords.filter((k) => {
    if (!k) return false;
    const kl = k.toLowerCase();
    if (searched.has(k)) return true;
    // 영문 키워드는 단어 단위로 (media ≠ multimedia)
    if (/^[a-z0-9 &'-]+$/.test(kl) ? new RegExp(`\\b${esc(kl)}\\b`).test(text) : text.includes(kl)) return true;
    if ((EN_SYN[k] ?? []).some((w) => new RegExp(`\\b${esc(w)}\\b`).test(text))) return true;
    return (KO_SYN[kl] ?? []).some((w) => text.includes(w));
  });
}

export interface Recommendation {
  notice: Notice;
  entityId: string;
  entityName: string;
  score: number;
  reasons: string[];
  checks: string[];
  days: number | null;
  upcoming: boolean;
}
/** Date-only comparisons follow Korea's calendar, independent of browser timezone. */
export function koreaCalendarDate(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(part("year"), part("month") - 1, part("day"), 12);
}
/** Transparent interest ranking; never an eligibility or approval decision. */
export function recommendNotices(notices: Notice[], entities: Entity[], keywords: KeywordSet, now = new Date()): Recommendation[] {
  const day = koreaCalendarDate(now);
  const ranked: Recommendation[] = [];
  for (const n of notices) {
    const days = daysLeft(n.deadline, day);
    if (days !== null && days < 0) continue;
    // Dates with a closing time are interpreted in Korea, like collected notices.
    const closing = n.applyEnd ?? n.deadline ?? "";
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(closing) && new Date(closing.replace(" ", "T") + ":00+09:00").getTime() < now.getTime()) continue;
    const text = `${n.title} ${n.summary ?? ""} ${n.grant?.eligibility ?? ""}`;
    if (keywords.exclude.some((k) => k.trim() && text.toLowerCase().includes(k.toLowerCase()))) continue;
    const topics = businessTopics(n);
    let best: Recommendation | undefined;
    for (const e of entities) {
      if (n.analysis?.verdicts.some((v) => v.entityId === e.id && v.status === "no")) continue;
      const home = residenceOf(e);
      const place = noticePlace(n);
      // District names in titles are more precise than a broad collected region.
      const namedDistricts = home ? (SIGUNGU[home.sido] ?? []).filter((g) => n.title.includes(g)) : [];
      if (namedDistricts.length && home?.sigungu && !namedDistricts.includes(home.sigungu)) continue;
      if (home && place && place !== "전국" && (place.sido !== home.sido || (place.sigungu && home.sigungu && place.sigungu !== home.sigungu))) continue;
      // An overseas event can still restrict applicants to a Korean region.
      const prefix = /^\[([^\]]+)\]/.exec(n.title)?.[1];
      if (home && prefix && Object.keys(SIGUNGU).some((s) => prefix === s) && prefix !== home.sido) continue;
      const business = e.type === "개인사업자" || e.type === "법인";
      if (e.type === "개인사업자" && /법인(?:사업자|기업)?\s*(?:만|한정)|개인사업자\s*(?:제외|불가)/.test(text)) continue;
      const profile = [e.profile?.headline, e.profile?.bio, e.profile?.notes, ...(e.profile?.genres ?? [])].join(" ");
      const interests = businessTopics({ title: profile, org: "" });
      const collaborationFirst = /협업|콜라보|공동기획/.test(profile);
      if (business && collaborationFirst && (n.kind === "residency" || /개인\s*작가|예술인\s*개인|개인\s*예술가/.test(n.title)) && !topics.includes("예술·브랜드 협업")) continue;
      const hits = topics.filter((t) => interests.includes(t));
      const keyHits = matchedKeywords(n, keywords.include);
      if (!hits.length && !keyHits.length) continue;
      const weights: Record<string, number> = { "뷰티": 45, "예술·브랜드 협업": 35, "수출바우처": 32, "디자인": 28, "박람회 지원": 24, "대출·융자": 18, "자금지원": 18, "기업부설연구소": 15, "여성기업": 12, "코트라": 10, "예경": 8, "문체부": 6 };
      let score = hits.reduce((sum, t) => sum + (weights[t] ?? 10), 0) + Math.min(30, keyHits.length * 10);
      const reasons = hits.sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0)).slice(0,2).map((t) => `관심 분야: ${TOPIC_LABELS[t] ?? t}`);
      if (keyHits.length) reasons.push(`내 키워드: ${keyHits.slice(0,2).join("·")}`);
      const checks = ["개인·기업 대상과 세부 신청 요건 확인"];
      if (home && place && place !== "전국") { score += 8; reasons.push(`${home.sido} 지역 공고`); }
      else if (place === "전국") reasons.push("전국 대상 표기");
      else checks.push("소재지 제한 확인");
      if (namedDistricts.length && !home?.sigungu) checks.push("시·군·구 소재지 확인");
      if (topics.includes("여성기업") && !e.documents.some((d) => /여성기업/.test(d))) checks.push("여성기업 확인서 필수 여부 확인");
      if (topics.includes("기업부설연구소") && !e.documents.some((d) => /연구소/.test(d))) checks.push("연구소 보유·설립 요건 확인");
      if (topics.includes("수출바우처")) checks.push("수출실적 기준연도·증빙 확인");
      if (topics.includes("대출·융자")) checks.push("상환·금리·보증료와 심사 조건 확인");
      if (topics.includes("자금지원")) checks.push("자부담·정산·상환 여부 확인");
      if (topics.includes("예술·브랜드 협업")) checks.push("기업·협업 파트너 참여 가능 여부 확인");
      if (days === null) { checks.push("접수 여부·마감일 확인"); score -= 5; }
      const upcoming = !!n.applyStart && (daysLeft(n.applyStart, day) ?? 0) > 0;
      if (upcoming) checks.push("접수 시작 전");
      if (days !== null && days >= 0 && days <= 7 && !upcoming) score += 5;
      const candidate = { notice: n, entityId: e.id, entityName: e.name, score, reasons, checks, days, upcoming };
      if (!best || score > best.score) best = candidate;
    }
    if (best && best.score >= 15) ranked.push(best);
  }
  // Deduplicate source mirrors before selecting the short list.
  const seen = new Set<string>();
  return ranked.sort((a,b) => b.score-a.score || (a.days ?? 9999)-(b.days ?? 9999) || a.notice.id.localeCompare(b.notice.id)).filter((r) => {
    const key = dedupeKey(r.notice);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
