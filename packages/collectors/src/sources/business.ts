import * as cheerio from "cheerio";
import type { Collector, RawItem } from "../base";
import { clean, normDate } from "../util";

/** Only application dates determine deadlines, never publication/event dates. */
export function applicationDates(period: string): Partial<RawItem> {
  const dates = [...period.matchAll(/\d{4}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2}/g)].map((m) => normDate(m[0])!);
  return { period, applyStart: dates[0], ...(dates.length >= 2 ? { applyEnd: dates.at(-1), deadline: dates.at(-1) } : {}) };
}
const unique = (items: RawItem[]) => {
  const out = new Map<string, RawItem>();
  for (const it of items) {
    const prev = out.get(it.url);
    out.set(it.url, prev ? { ...it, ...prev, fields: [...new Set([...(prev.fields ?? []), ...(it.fields ?? [])])] } : it);
  }
  return [...out.values()];
};
const BIZ = "https://www.bizinfo.go.kr";
// Public search form: title, ministry, implementing agency and content are separate fields.
export const BUSINESS_SEARCHES = [
  ["searchPblancNm", "뷰티"], ["searchPblancNm", "화장품"],
  ["searchPblancNm", "수출바우처"], ["searchPblancNm", "수출지원기반활용"],
  ["searchExcInsttNm", "대한무역투자진흥공사"], ["searchExcInsttNm", "예술경영지원센터"],
  ["pldirJrsdCodeNm", "문화체육관광부"], ["searchPblancNm", "박람회"], ["searchPblancNm", "전시회"],
  ["CONTS", "기업부설연구소"], ["searchPblancNm", "연구개발"], ["searchPblancNm", "디자인"],
  ["searchPblancNm", "여성기업"], ["searchPblancNm", "여성창업"],
  ["searchPblancNm", "서울"], ["searchPblancNm", "송파"],
] as const;

export function parseBizinfo(html: string): RawItem[] {
  const $ = cheerio.load(html);
  const out: RawItem[] = [];
  $('a[href*="selectSIIA200Detail.do"]').each((_, el) => {
    const a = $(el), cells = a.closest("tr").find("td");
    const id = new URL(a.attr("href")!, BIZ).searchParams.get("pblancId");
    const title = clean(a.text());
    if (!id || !/^PBLN_\d+$/.test(id) || !title || cells.length < 7) return;
    const ministry = clean(cells.eq(4).text()), agency = clean(cells.eq(5).text());
    out.push({ title, url: `${BIZ}/sii/siia/selectSIIA200Detail.do?pblancId=${id}`,
      org: [ministry, agency].filter(Boolean).join(" · "),
      fields: [clean(cells.eq(1).text())], postedAt: normDate(cells.eq(6).text()),
      region: /^\[([^\]]+)\]/.exec(title)?.[1], ...applicationDates(clean(cells.eq(3).text())),
    });
  });
  if (!out.length && !/검색된|검색\s*결과|등록된|조회된|지원사업 공고/.test($.text())) throw new Error("기업마당 목록 형식 확인 필요");
  return unique(out);
}
export function parseBizinfoDetail(html: string): Partial<RawItem> {
  const $ = cheerio.load(html);
  const value = (label: string) => clean($(".view_cont li").filter((_, el) => clean($(el).find(".s_title").text()) === label).find(".txt").text());
  const summary = value("사업개요");
  return { summary: summary || undefined, ...applicationDates(value("신청기간")) };
}
export const bizinfo: Collector = {
  id: "bizinfo", name: "기업마당", homepage: BIZ,
  async list(ctx) {
    const all: RawItem[] = [];
    for (const [condition, keyword] of BUSINESS_SEARCHES) {
      for (let page = 1; page <= 10; page++) {
        const params = new URLSearchParams({ condition, condition1: "AND", keyword, rows: "15", cpage: String(page), schEndAt: "N" });
        const items = parseBizinfo(await ctx.fetchText(`${BIZ}/sii/siia/selectSIIA200View.do?${params}`));
        all.push(...items.map((it) => ({ ...it, fields: [...(it.fields ?? []), keyword] })));
        if (items.length < 15) break;
      }
    }
    return unique(all).map((it) => ({ ...it, detail: async () => parseBizinfoDetail(await ctx.fetchText(it.url)) }));
  },
};

const KOTRA = "https://www.kotra.or.kr";
export function parseKotra(html: string): RawItem[] {
  const $ = cheerio.load(html), out: RawItem[] = [];
  $(".card").each((_, el) => {
    const row = $(el), a = row.find("a.card-tit");
    if (/신청마감|모집마감|접수마감/.test(row.find(".card-header-meta-data").text())) return;
    const path = /['"]([^'"]*selectBizMntInfoDetail\.do[^'"]*)['"]/.exec(a.attr("href") ?? "")?.[1];
    if (!path) return;
    const url = new URL(path, KOTRA);
    if (url.origin !== KOTRA || !url.searchParams.get("dtlBizMntNo")) return;
    const get = (label: string) => clean(row.find("dt").filter((_, dt) => clean($(dt).text()) === label).first().next("dd").text());
    out.push({ title: clean(a.text()), url: url.toString(), org: "KOTRA", fields: [clean(row.find(".card-badge").text())],
      overseas: get("개최장소") === "해외", ...applicationDates(get("신청기간")),
    });
  });
  if (!$(".card").length && !/없습니다|없어요|검색결과|검색 결과/.test($.text())) throw new Error("KOTRA 목록 형식 확인 필요");
  return unique(out);
}
export const kotra: Collector = {
  id: "kotra", name: "KOTRA", homepage: KOTRA,
  async list(ctx) {
    const all: RawItem[] = [];
    for (const [endpoint, mode] of [["selectBmBizRcritYListNewAjax.do", "N"], ["selectBmBizTermListNewAjax.do", "Y"]]) {
      const seen = new Set<string>();
      for (let page = 1; page <= 5; page++) {
        const body = new URLSearchParams({ pageSize: "100", query: "", sch_biz_name: "", schwrdVal: "", pageNoA: String(page), pageNo: String(page), pageNo2: String(page), startCount: String((page - 1) * 100), listCount: "100", collection: "business_application", sch_appl_yn: mode, sch_nation_cd: "Y" });
        const html = await ctx.fetchText(`${KOTRA}/module/subhome/bizAply/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
        const items = parseKotra(html);
        const fresh = items.filter((it) => !seen.has(it.url));
        fresh.forEach((it) => seen.add(it.url)); all.push(...fresh);
        if (cheerio.load(html)(".card").length < 100 || !fresh.length) break;
      }
    }
    return unique(all);
  },
};

const WBIZ = "https://www.wbiz.or.kr";
export function parseWbiz(html: string): RawItem[] {
  const $ = cheerio.load(html), out: RawItem[] = [];
  $('a[onclick*="fnViewDetail"]').each((_, el) => {
    const a = $(el), id = /fnViewDetail\(['"](\d+)['"]\)/.exec(a.attr("onclick") ?? "")?.[1];
    if (!id || !a.find(".ing").length || clean(a.find(".tit").text()).length < 4) return;
    const period = clean(a.find("dt").filter((_, dt) => clean($(dt).text()) === "신청기간").next("dd").text());
    out.push({ title: clean(a.find(".tit").text()), url: `${WBIZ}/notice/bizNewDetail.do?nttId=${id}`, org: "여성기업종합지원센터", ...applicationDates(period) });
  });
  if (!out.length && !/검색된|없습니다|사업공고/.test($.text())) throw new Error("여성기업 목록 형식 확인 필요");
  return unique(out);
}
export const wbiz: Collector = {
  id: "wbiz", name: "여성기업 종합정보포털", homepage: WBIZ,
  async list(ctx) {
    const all: RawItem[] = [];
    for (let page = 1; page <= 3; page++) all.push(...parseWbiz(await ctx.fetchText(`${WBIZ}/notice/bizNew.do?searchOp8=recruiting&pageIndex=${page}`)));
    return unique(all);
  },
};
