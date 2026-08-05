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
};

/* 별지기의 지금 이름 — 토스트·이야기가 전부 이걸 부른다 */
export const heroName = () => D.champNameOf(store.champCfg.name);
