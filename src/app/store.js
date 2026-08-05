/* =====================================================
 * 기기 저장소(localStorage) — 판이 아니라 기기에 속하는 것들.
 * 별조각 · 별의 축복 · 최고 기록 · 그래픽/이야기 설정 · 자동 저장 · 별지기 꾸미기.
 * ===================================================== */
import * as D from '../data.js';

export const store = {
  get shards() { return Number(localStorage.getItem('mathdef_shards') || 0); },
  set shards(v) { localStorage.setItem('mathdef_shards', String(v)); },
  get meta() { try { return JSON.parse(localStorage.getItem('mathdef_meta') || '{}'); } catch { return {}; } },
  set meta(v) { localStorage.setItem('mathdef_meta', JSON.stringify(v)); },
  get diff() { return localStorage.getItem('mathdef_diff') || 'normal'; },
  set diff(v) { localStorage.setItem('mathdef_diff', v); },
  best(diff) { return Number(localStorage.getItem(`mathdef_best_${diff}`) || 0); },
  setBest(diff, w) { localStorage.setItem(`mathdef_best_${diff}`, String(w)); },
  get gfx() { return localStorage.getItem('mathdef_gfx'); },
  set gfx(v) { localStorage.setItem('mathdef_gfx', v); },
  /* 배경 장식 끄기 — 너무 느린 기기에서 한 번 켜지면 계속 유지된다.
   * 장식을 켜고 끄는 건 지형·카메라까지 바뀌는 일이라 실행 중엔 못 바꾼다.
   * 그래서 "다음에 켤 때부터"로 미룬다. */
  get decorOff() { return localStorage.getItem('mathdef_decor_off') === '1'; },
  set decorOff(v) { localStorage.setItem('mathdef_decor_off', v ? '1' : '0'); },
  get storyOff() { return localStorage.getItem('mathdef_story_off') === '1'; },
  set storyOff(v) { localStorage.setItem('mathdef_story_off', v ? '1' : '0'); },
  /* 자동 저장 슬롯 (웨이브가 끝날 때마다 갱신, 함락되면 삭제) */
  get autosave() { try { return JSON.parse(localStorage.getItem('mathdef_autosave') || 'null'); } catch { return null; } },
  set autosave(v) {
    if (v == null) localStorage.removeItem('mathdef_autosave');
    else localStorage.setItem('mathdef_autosave', JSON.stringify(v));
  },
  /* 별지기 꾸미기(이름·옷장) — 판이 아니라 기기에 속한다. 판이 끝나도 "내 캐릭터"는 남는다 */
  get champCfg() { try { return JSON.parse(localStorage.getItem('mathdef_champ') || '{}'); } catch { return {}; } },
  set champCfg(v) { localStorage.setItem('mathdef_champ', JSON.stringify(v)); },
  /* 서른 번째 아침(승리) 횟수 — [n]번째 원소 = n회차에서의 클리어 수가 아니라 총합만 센다 */
  get victories() { return Number(localStorage.getItem('mathdef_victories') || 0); },
  set victories(v) { localStorage.setItem('mathdef_victories', String(v)); },
  get trialClears() { return Number(localStorage.getItem('mathdef_trial_clears') || 0); },
  set trialClears(v) { localStorage.setItem('mathdef_trial_clears', String(v)); },
};

/* 별지기의 지금 이름 — 토스트·이야기가 전부 이걸 부른다 */
export const heroName = () => D.champNameOf(store.champCfg.name);

/* =====================================================
 * 누적 기록 — 도감 · 수학 성장 · 업적 (전부 기기 저장)
 * 처치마다 localStorage에 쓰면 아깝다: 메모리에 들고 있다가
 * flushRecords()로 미룬다 (autoSave와 같은 타이밍 + pagehide).
 * ===================================================== */
const load = (key, dflt) => {
  try { return Object.assign(dflt, JSON.parse(localStorage.getItem(key) || 'null') || {}); }
  catch { return dflt; }
};

/* 도감: 만들어 본 용사(직업:등급 → 횟수) · 물리친 몬스터(종류 → 마릿수) */
export const codex = load('mathdef_codex', { heroes: {}, kills: {} });
/* 수학 성장: 전체 합계 + 유형별("학년|유형 이름") 풀이 수·정답·한 번에 */
export const mathLog = load('mathdef_mathlog', { total: 0, correct: 0, clean: 0, types: {} });
/* 업적: 달성한 key → 1. 한 번 달성하면 영원히 남는다 */
export const earned = load('mathdef_achievements', {});

let dirty = false;
export function markDirty() { dirty = true; }
export function flushRecords() {
  if (!dirty) return;
  dirty = false;
  localStorage.setItem('mathdef_codex', JSON.stringify(codex));
  localStorage.setItem('mathdef_mathlog', JSON.stringify(mathLog));
  localStorage.setItem('mathdef_achievements', JSON.stringify(earned));
}

export function codexAddHero(cls, tier) {
  const key = `${cls}:${tier}`;
  codex.heroes[key] = (codex.heroes[key] || 0) + 1;
  dirty = true;
}
export function codexAddKill(type) {
  codex.kills[type] = (codex.kills[type] || 0) + 1;
  dirty = true;
}

/* 문제 하나의 결과를 누적한다. clean = 한 번에·힌트 없이 */
export function mathAdd(grade, label, ok, clean) {
  mathLog.total++;
  if (ok) mathLog.correct++;
  if (clean) mathLog.clean++;
  const key = `${grade}|${label || '기타'}`;
  const t = mathLog.types[key] || (mathLog.types[key] = { t: 0, c: 0, cl: 0 });
  t.t++;
  if (ok) t.c++;
  if (clean) t.cl++;
  dirty = true;
}
