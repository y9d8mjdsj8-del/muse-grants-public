"use client";
import { TOPIC_GROUPS, TOPIC_LABELS, selectedTopics, type BusinessTopic, type Entity } from "@muse/core";
import { Button, cx, Sheet } from "./ui";

export type Sort = "deadline" | "fit" | "recent";
export interface Filters {
  topic?: BusinessTopic | "all";
  topics?: BusinessTopic[];
  region: string;
  entity: string;
  overseas: boolean;
  /** 창업 지원 공고 (K-Startup 등): 모두 / 빼기 / 창업만 */
  startup?: "all" | "hide" | "only";
  /** 국내만 */
  domestic?: boolean;
  /** 지역 조건(주거지·활동지역)이 맞지 않는 공고 빼고 보기 — 기본은 모두 보기 */
  regionOk?: boolean;
  saved: boolean;
  showClosed: boolean;
  sort: Sort;
}
export const DEFAULT_FILTERS: Filters = { region: "all", entity: "all", overseas: false, domestic: false, regionOk: false, saved: false, showClosed: false, sort: "deadline" };
export const activeCount = (f: Filters) =>
  selectedTopics(f).length + (f.region !== "all" ? 1 : 0) + (f.entity !== "all" ? 1 : 0) + (f.overseas ? 1 : 0) + (f.domestic ? 1 : 0) + (f.regionOk ? 1 : 0) + (f.startup && f.startup !== "all" ? 1 : 0) + (f.saved ? 1 : 0) + (f.showClosed ? 1 : 0);

const SORTS: [Sort, string][] = [["deadline", "마감 임박순"], ["fit", "적합도순"], ["recent", "최신순"]];

/** Purpose first; optional details narrow the selection without hiding active filters. */
export function TopicFilters({ f, set, resultCount = 0 }: { f: Filters; set(f: Filters): void; resultCount?: number }) {
  const selected = selectedTopics(f);
  const label = (t: BusinessTopic) => TOPIC_LABELS[t] ?? t;
  const toggle = (t: BusinessTopic) => set({ ...f, topic: "all", topics: selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t] });
  const chips = (topics: BusinessTopic[]) => <div className="flex flex-wrap gap-2">{topics.map((t) => <Chip key={t} on={selected.includes(t)} onClick={() => toggle(t)}>{label(t)}</Chip>)}</div>;
  const detailCount = selected.filter((t) => !TOPIC_GROUPS[0].topics.includes(t)).length;
  return <section aria-label="맞춤 공고 찾기" className="mt-4 rounded-xl border border-line bg-surface p-4">
    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
      <h2 className="text-[15px] font-bold">어떤 지원이 필요한가요?</h2>
      <span role="status" className="text-[13px] text-mute">현재 조건 {resultCount}건</span>
    </div>
    <p className="text-[12px] text-mute mb-3">필요한 지원을 여러 개 골라도 돼요. 기관이나 업종은 아래에서 좁힐 수 있어요.</p>
    {chips(TOPIC_GROUPS[0].topics)}
    <details className="mt-3 border-t border-line pt-3">
      <summary className="cursor-pointer text-[13px] font-semibold">관심 분야·기관·대상 더 보기{detailCount > 0 ? ` · ${detailCount}개 선택` : ""}</summary>
      {TOPIC_GROUPS.slice(1).map((g) => <div key={g.id} className="mt-3"><h3 className="text-[12px] font-semibold text-mute mb-2">{g.label}</h3>{chips(g.topics)}</div>)}
      <p className="text-[12px] text-mute mt-3">같은 묶음에서는 하나라도 맞으면 표시하고, 다른 묶음끼리는 모두 맞는 공고를 보여요.</p>
    </details>
    {selected.length > 0 && <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-2" aria-label="선택한 조건"><span className="text-[12px] text-mute">선택한 조건</span>
        {selected.map((t) => <button key={t} aria-label={`${label(t)} 조건 해제`} onClick={() => toggle(t)} className="text-[12px] rounded-full border border-line px-3 py-2">{label(t)} ×</button>)}
        <button onClick={() => set({ ...f, topic: "all", topics: [] })} className="text-[12px] underline underline-offset-2">지원 조건 초기화</button>
      </div>
      {resultCount === 0 && <p className="text-[12px] text-mute mt-2">조건을 하나씩 해제하거나 검색·지역 조건을 넓혀 보세요.</p>}
    </div>}
    <p className="text-[12px] text-mute mt-3">공고를 찾기 위한 분류예요. 지원 자격은 개인사업자·지역·서류 요건을 원문에서 확인해 주세요.</p>
    {selected.includes("대출·융자") && <p className="text-[12px] text-mute mt-1">대출·보증은 상환, 금리·보증료 및 심사 조건을 확인해 주세요.</p>}
    {selected.includes("자금지원") && <p className="text-[12px] text-mute mt-1">자금지원에 융자가 포함될 수 있어요. 상환 여부·자부담·정산·환수 조건을 확인해 주세요.</p>}
    {selected.includes("여성기업") && <p className="text-[12px] text-mute mt-1">여성기업 확인서가 없어도 공고를 볼 수 있어요. 발급 필수 여부는 별도 확인이 필요해요.</p>}
    {selected.includes("기업부설연구소") && <p className="text-[12px] text-mute mt-1">연구소 설립과 연구개발 공고를 함께 보여요. 연구소 보유가 필수인지는 원문에서 확인해 주세요.</p>}
    {selected.includes("수출바우처") && <p className="text-[12px] text-mute mt-1">수출 실적 기준연도·인정금액·증빙과 중복지원 조건을 확인해 주세요.</p>}
    {selected.includes("예술·브랜드 협업") && <p className="text-[12px] text-mute mt-1">예술 관련 협업 키워드가 있는 공고예요. 기업·파트너·컨소시엄 참여 가능 여부는 원문에서 확인해 주세요.</p>}
  </section>;
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick(): void }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={cx("h-10 px-4 rounded-full text-[14px] border transition-colors", on ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-line-strong text-mute")}>
      {children}
    </button>
  );
}

/** 모바일: 바텀시트로 모든 필터 */
export function FilterSheet({ open, onClose, f, set, regions, entities, resultCount }: {
  open: boolean; onClose(): void; f: Filters; set(f: Filters): void; regions: string[]; entities: Entity[]; resultCount: number;
}) {
  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="py-3.5 border-b border-line last:border-0">
      <h3 className="text-[13px] font-bold text-mute mb-2.5">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
  return (
    <Sheet open={open} onClose={onClose} title="필터와 정렬">
      <Group title="정렬">
        {SORTS.map(([k, l]) => <Chip key={k} on={f.sort === k} onClick={() => set({ ...f, sort: k })}>{l}</Chip>)}
      </Group>
      <Group title="지원 주체">
        <Chip on={f.entity === "all"} onClick={() => set({ ...f, entity: "all" })}>모두</Chip>
        {entities.map((e) => <Chip key={e.id} on={f.entity === e.id} onClick={() => set({ ...f, entity: e.id })}>{e.name}</Chip>)}
      </Group>
      <Group title="지역">
        <Chip on={f.region === "all"} onClick={() => set({ ...f, region: "all" })}>전체</Chip>
        {regions.map((r) => <Chip key={r} on={f.region === r} onClick={() => set({ ...f, region: r })}>{r}</Chip>)}
      </Group>
      <Group title="더 보기">
        <Chip on={f.saved} onClick={() => set({ ...f, saved: !f.saved })}>★ 저장한 것만</Chip>
        <Chip on={!!f.domestic} onClick={() => set({ ...f, domestic: !f.domestic, overseas: false })}>국내만</Chip>
        <Chip on={f.overseas} onClick={() => set({ ...f, overseas: !f.overseas, domestic: false })}>해외만</Chip>
        <Chip on={!!f.regionOk} onClick={() => set({ ...f, regionOk: !f.regionOk })}>📍 지역 조건 맞는 것만</Chip>
        <Chip on={f.startup === "only"} onClick={() => set({ ...f, startup: f.startup === "only" ? "all" : "only" })}>🚀 창업 지원만</Chip>
        <Chip on={f.startup === "hide"} onClick={() => set({ ...f, startup: f.startup === "hide" ? "all" : "hide" })}>창업 지원 빼기</Chip>
        <Chip on={f.showClosed} onClick={() => set({ ...f, showClosed: !f.showClosed })}>마감된 공고 포함</Chip>
      </Group>
      <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-2 bg-surface flex gap-2">
        <Button className="flex-1 h-12" onClick={() => set(DEFAULT_FILTERS)}>초기화</Button>
        <Button variant="primary" className="flex-[2] h-12" onClick={onClose}>{resultCount}건 보기</Button>
      </div>
    </Sheet>
  );
}

/** PC: 도구 모음에 펼쳐 놓는 필터 */
export function FilterBar({ f, set, regions, entities, showOverseas }: { f: Filters; set(f: Filters): void; regions: string[]; entities: Entity[]; showOverseas: boolean }) {
  const select = "h-9 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink focus:outline-none focus:border-brand";
  const tog = (on: boolean) => cx("h-9 px-3 rounded-lg border text-[13px] font-medium", on ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-mute hover:text-ink");
  return (
    <>
      <select aria-label="지역" className={select} value={f.region} onChange={(e) => set({ ...f, region: e.target.value })}>
        <option value="all">전체 지역</option>
        {regions.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <select aria-label="지원 주체" className={select} value={f.entity} onChange={(e) => set({ ...f, entity: e.target.value })}>
        <option value="all">모든 주체</option>
        {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      {showOverseas && <button aria-pressed={!!f.domestic} className={tog(!!f.domestic)} onClick={() => set({ ...f, domestic: !f.domestic, overseas: false })}>국내</button>}
      {showOverseas && <button aria-pressed={f.overseas} className={tog(f.overseas)} onClick={() => set({ ...f, overseas: !f.overseas, domestic: false })}>해외</button>}
      <button aria-pressed={!!f.regionOk} title="내 주거지·활동지역 조건이 맞지 않는 공고를 잠시 빼고 봐요" className={tog(!!f.regionOk)} onClick={() => set({ ...f, regionOk: !f.regionOk })}>📍 지역 맞음</button>
      <select aria-label="창업 지원 공고" className={select} value={f.startup ?? "all"} onChange={(e) => set({ ...f, startup: e.target.value as Filters["startup"] })}>
        <option value="all">창업 공고 포함</option>
        <option value="hide">창업 공고 빼기</option>
        <option value="only">창업 공고만</option>
      </select>
      <button aria-pressed={f.saved} className={cx(tog(f.saved), f.saved && "!border-amber !bg-amber-soft !text-amber")} onClick={() => set({ ...f, saved: !f.saved })}>★ 저장한 것</button>
      <select aria-label="정렬" className={select} value={f.sort} onChange={(e) => set({ ...f, sort: e.target.value as Sort })}>
        {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </>
  );
}
