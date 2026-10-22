import type { Notice, NoticeKind } from "./types";

/** 출처 기준 1차 분류 */
const SOURCE_KIND: Record<string, NoticeKind> = {
  나라장터: "service",
  "문화예술 내일": "edu",
  아트모아: "edu",
  "해외레지던스": "residency",
};

/** 제목 키워드 2차 분류 (앞에 있을수록 우선) */
const RULES: [RegExp, NoticeKind][] = [
  [/대관료\s*지원/, "grant"], // 대관료 지원은 지원사업 (+대관 태그)
  [/(용역|입찰|제안서\s*공모|위탁\s*운영\s*사업자)/, "service"],
  [/(레지던시|레지던스|입주\s*작가|입주\s*예술가|입주\s*단체|창작\s*공간\s*입주|창작스튜디오\s*입주|residency|artist[-\s]in[-\s]residence)/i, "residency"],
  [/(수강생|교육생|아카데미|워크숍|워크샵|강좌|연수|클래스|교육\s*참가자|교육과정)/, "edu"],
  [/(대관|공간\s*대여|정기\s*대관|수시\s*대관|공연장\s*사용)/, "venue"],
];

export function classifyKind(title: string, source?: string): NoticeKind {
  if (source && SOURCE_KIND[source]) return SOURCE_KIND[source];
  for (const [re, kind] of RULES) if (re.test(title)) return kind;
  return "grant";
}

/** 창업·스타트업 지원 공고 (K-Startup 등) — 탭은 지원사업, "창업" 태그로 따로 보거나 뺄 수 있음 */
export const STARTUP_RE = /(창업|스타트업|start-?up|벤처|액셀러레이|엑셀러레이|투자\s*유치|사업화\s*지원|예비\s*기업가)/i;
export const isStartup = (n: { tags: string[] }) => n.tags.includes("창업");

export function extraTags(title: string, source?: string): string[] {
  const tags: string[] = [];
  if (source === "K-Startup" || STARTUP_RE.test(title)) tags.push("창업");
  if (/대관료/.test(title)) tags.push("대관");
  if (/(해외|국제|international)/i.test(title)) tags.push("해외");
  if (/(청년|39세)/.test(title)) tags.push("청년");
  return [...tags, ...businessTopics({ title, org: source ?? "" })];
}

/** 분야는 지원 자격 판정이 아닌 검색용 분류이며 여러 분야에 동시에 속할 수 있다. */
export const BUSINESS_TOPICS = ["뷰티", "코트라", "수출바우처", "대출·융자", "자금지원", "예경", "문체부", "박람회 지원", "기업부설연구소", "디자인", "여성기업", "예술·브랜드 협업"] as const;
export type BusinessTopic = typeof BUSINESS_TOPICS[number];
const TOPIC_RULES: [BusinessTopic, RegExp][] = [
  ["뷰티", /뷰티|화장품|미용|향료|향수|조향|코스메틱|cosmetic|beauty|fragrance|perfume/i],
  ["코트라", /코트라|KOTRA|대한무역투자진흥공사/i],
  ["수출바우처", /수출\s*바우처|수출\s*지원\s*기반\s*활용|export\s*voucher/i],
  ["대출·융자", /대출|융자|정책\s*자금|운전\s*자금|시설\s*자금|특례\s*보증|신용\s*보증|이차\s*보전/],
  ["자금지원", /자금\s*지원|지원\s*자금|지원금|보조금|사업비\s*지원|사업화\s*지원|이차\s*보전|이자\s*지원/],
  ["예경", /예술경영지원센터|아트코리아랩|예경/],
  ["문체부", /문화체육관광부|문체부/],
  ["박람회 지원", /박람회|전시회|해외\s*전시|공동관|한국관|부스|엑스포|\bexpo\b|trade\s*fair/i],
  ["기업부설연구소", /기업\s*부설\s*연구소|연구\s*전담\s*부서|연구개발|R\s*&\s*D|기술개발|산업기술진흥협회/i],
  ["디자인", /디자인|디자이너|design|패키징|브랜딩/i],
  ["여성기업", /여성\s*(기업|창업|경제인|CEO|대표)|여경협|WBIZ/i],
  ["예술·브랜드 협업", /(?=.*(?:예술|아트|작가|공예|문화))(?=.*(?:협업|콜라보|협력|공동기획|컨소시엄|브랜드))/i],
];
type TopicNotice = Pick<Notice, "title" | "org"> & Partial<Pick<Notice, "sources" | "summary" | "tags" | "fields">>;
export function businessTopics(n: TopicNotice): BusinessTopic[] {
  const text = [n.title, n.org, n.summary, ...(n.sources ?? []), ...(n.fields ?? [])].join(" ");
  return TOPIC_RULES.filter(([label, re]) => n.tags?.includes(label) || re.test(text)).map(([label]) => label);
}

/** Display labels may evolve while saved topic identifiers remain stable. */
export const TOPIC_LABELS: Partial<Record<BusinessTopic, string>> = {
  "자금지원": "사업비·자금 지원", "대출·융자": "대출·정책자금",
  "박람회 지원": "전시·박람회", "디자인": "디자인·브랜딩",
  "기업부설연구소": "연구개발·연구소", "뷰티": "뷰티·향·화장품",
  "코트라": "KOTRA", "예경": "예술경영지원센터", "문체부": "문화체육관광부",
  "여성기업": "여성기업·여성창업",
};
export const TOPIC_GROUPS: { id: string; label: string; topics: BusinessTopic[] }[] = [
  { id: "purpose", label: "어떤 지원이 필요한가요?", topics: ["자금지원", "대출·융자", "수출바우처", "박람회 지원", "디자인", "기업부설연구소", "예술·브랜드 협업"] },
  { id: "interest", label: "관심 분야", topics: ["뷰티"] },
  { id: "institution", label: "기관", topics: ["코트라", "예경", "문체부"] },
  { id: "target", label: "대상 관련 공고", topics: ["여성기업"] },
];
export type TopicSelection = { topic?: BusinessTopic | "all"; topics?: BusinessTopic[] };
export function selectedTopics(f: TopicSelection): BusinessTopic[] {
  const values = Array.isArray(f.topics) ? f.topics : f.topic && f.topic !== "all" ? [f.topic] : [];
  return [...new Set(values.filter((t) => BUSINESS_TOPICS.includes(t)))];
}
/** Alternatives within a group; intersections across groups. */
export function matchesTopicSelection(n: TopicNotice, f: TopicSelection): boolean {
  const selected = selectedTopics(f);
  if (!selected.length) return true;
  const found = businessTopics(n);
  return TOPIC_GROUPS.every((g) => {
    const choices = selected.filter((t) => g.topics.includes(t));
    return !choices.length || choices.some((t) => found.includes(t));
  });
}
