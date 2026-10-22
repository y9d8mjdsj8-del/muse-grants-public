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
export const BUSINESS_TOPICS = ["뷰티", "코트라", "수출바우처", "예경", "문체부", "박람회 지원", "기업부설연구소", "디자인", "여성기업"] as const;
export type BusinessTopic = typeof BUSINESS_TOPICS[number];
const TOPIC_RULES: [BusinessTopic, RegExp][] = [
  ["뷰티", /뷰티|화장품|미용|코스메틱|cosmetic|beauty/i],
  ["코트라", /코트라|KOTRA|대한무역투자진흥공사/i],
  ["수출바우처", /수출\s*바우처|수출\s*지원\s*기반\s*활용|export\s*voucher/i],
  ["예경", /예술경영지원센터|아트코리아랩|예경/],
  ["문체부", /문화체육관광부|문체부/],
  ["박람회 지원", /박람회|전시회|해외\s*전시|공동관|한국관|부스|엑스포|\bexpo\b|trade\s*fair/i],
  ["기업부설연구소", /기업\s*부설\s*연구소|연구\s*전담\s*부서|연구개발|R\s*&\s*D|기술개발|산업기술진흥협회/i],
  ["디자인", /디자인|디자이너|design|패키징|브랜딩/i],
  ["여성기업", /여성\s*(기업|창업|경제인|CEO|대표)|여경협|WBIZ/i],
];
type TopicNotice = Pick<Notice, "title" | "org"> & Partial<Pick<Notice, "sources" | "summary" | "tags" | "fields">>;
export function businessTopics(n: TopicNotice): BusinessTopic[] {
  const text = [n.title, n.org, n.summary, ...(n.sources ?? []), ...(n.fields ?? [])].join(" ");
  return TOPIC_RULES.filter(([label, re]) => n.tags?.includes(label) || re.test(text)).map(([label]) => label);
}
