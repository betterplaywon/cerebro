import { describe, expect, it } from 'vitest';
import {
  SCENE,
  buildCrowdLayout,
  pickFocusIndex,
  timelineAt,
  bell,
  easeInOutSine,
  easeOutQuint,
} from './cerebro-timeline';

const CANDIDATES = [10, 20, 30, 40, 50, 60, 70, 80];

describe('cerebro-timeline / easings', () => {
  it('easeInOutSine은 [0,1]에서 0→1 단조 증가한다', () => {
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const v = easeInOutSine(i / 20);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
    expect(easeInOutSine(0)).toBeCloseTo(0);
    expect(easeInOutSine(1)).toBeCloseTo(1);
  });

  it('easeOutQuint은 0→1 단조 증가하고 끝에서 완만하다', () => {
    expect(easeOutQuint(0)).toBeCloseTo(0);
    expect(easeOutQuint(1)).toBeCloseTo(1);
    // 후반이 전반보다 느려진다(ease-out): 0.9→1.0 증가폭 < 0.0→0.1 증가폭
    const early = easeOutQuint(0.1) - easeOutQuint(0);
    const late = easeOutQuint(1) - easeOutQuint(0.9);
    expect(late).toBeLessThan(early);
  });

  it('bell은 center에서 1, 폭 밖에서 0이고 절대 음수가 아니다', () => {
    expect(bell(3.3, 3.3, 0.3)).toBeCloseTo(1);
    expect(bell(3.0, 3.3, 0.3)).toBeCloseTo(0);
    expect(bell(3.6, 3.3, 0.3)).toBeCloseTo(0);
    expect(bell(10, 3.3, 0.3)).toBe(0);
    for (let t = 2; t <= 5; t += 0.05) expect(bell(t, 3.3, 0.3)).toBeGreaterThanOrEqual(0);
  });
});

describe('cerebro-timeline / timelineAt', () => {
  it('인트로는 1회만 — total 이전은 intro, 이후는 loop 위상이다', () => {
    expect(timelineAt(0, CANDIDATES).phase).toBe('intro');
    expect(timelineAt(SCENE.intro.total - 0.01, CANDIDATES).phase).toBe('intro');
    expect(timelineAt(SCENE.intro.total + 0.01, CANDIDATES).phase).toBe('loop');
    expect(timelineAt(SCENE.intro.total + 100, CANDIDATES).phase).toBe('loop');
  });

  it('flash는 어디서도 burstPeak를 넘지 않고, 버스트 밖 인트로 구간에선 0이다', () => {
    for (let t = 0; t < 30; t += 0.02) {
      const f = timelineAt(t, CANDIDATES).flash;
      expect(f).toBeLessThanOrEqual(SCENE.intro.burstPeak + 1e-9);
      expect(f).toBeGreaterThanOrEqual(0);
    }
    // 인트로 초반(근접)엔 섬광 없음
    expect(timelineAt(0.5, CANDIDATES).flash).toBe(0);
    expect(timelineAt(2.0, CANDIDATES).flash).toBe(0);
  });

  it('카메라 z가 인트로 위상 경계에서 연속이다(점프 없음)', () => {
    const eps = 1e-3;
    for (const b of [SCENE.intro.p0End, SCENE.intro.p1End, SCENE.intro.p2End]) {
      const before = timelineAt(b - eps, CANDIDATES).camZ;
      const after = timelineAt(b + eps, CANDIDATES).camZ;
      expect(Math.abs(after - before)).toBeLessThan(0.05);
    }
  });

  it('uReveal은 인트로 동안 0→1로 단조 증가하고 루프에서 1을 유지한다', () => {
    let prev = -1;
    for (let t = 0; t <= SCENE.intro.total; t += 0.05) {
      const v = timelineAt(t, CANDIDATES).uReveal;
      expect(v).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = v;
    }
    expect(timelineAt(SCENE.intro.total, CANDIDATES).uReveal).toBeCloseTo(1);
    expect(timelineAt(SCENE.intro.total + 50, CANDIDATES).uReveal).toBeCloseTo(1);
  });

  it('히어로는 인트로 동안 탈색(0→1)되고 fadeEnd까지 사라진다', () => {
    expect(timelineAt(0, CANDIDATES).heroColorT).toBeCloseTo(0);
    expect(timelineAt(SCENE.intro.p1End, CANDIDATES).heroColorT).toBeCloseTo(1);
    expect(timelineAt(SCENE.hero.fadeEnd, CANDIDATES).heroOpacity).toBeCloseTo(0);
    expect(timelineAt(SCENE.hero.fadeStart, CANDIDATES).heroOpacity).toBeCloseTo(1);
  });

  it('루프는 주목(focusBlend 상승)→후퇴(하강)→유영(0) 사이클을 돈다', () => {
    const base = SCENE.intro.total;
    const push = timelineAt(base + SCENE.loop.pushEnd - 0.1, CANDIDATES);
    const pull = timelineAt(base + SCENE.loop.pullEnd + 0.5, CANDIDATES);
    const drift = timelineAt(base + SCENE.loop.cycle - 0.1, CANDIDATES);
    expect(push.camMode).toBe('focus');
    expect(push.focusBlend).toBeGreaterThan(0.7);
    expect(pull.camMode).toBe('drift'); // pullEnd+0.5는 drift 구간
    expect(drift.camMode).toBe('drift');
    expect(drift.focusBlend).toBeCloseTo(0);
    // spotStrength는 focusBlend를 따른다
    expect(push.spotStrength).toBeCloseTo(push.focusBlend);
  });
});

describe('cerebro-timeline / 군중 레이아웃 & 포커스', () => {
  it('동일 시드는 동일 레이아웃을 만든다(결정적)', () => {
    const a = buildCrowdLayout(500, 1337);
    const b = buildCrowdLayout(500, 1337);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(a.focusCandidates).toEqual(b.focusCandidates);
  });

  it('레이아웃은 nearZ~farZ 범위에 배치되고 후보가 비어있지 않다', () => {
    const l = buildCrowdLayout(2000, 7);
    expect(l.count).toBe(2000);
    expect(l.focusCandidates.length).toBeGreaterThan(0);
    for (let i = 0; i < l.count; i++) {
      const z = l.positions[i * 3 + 2];
      expect(z).toBeLessThanOrEqual(SCENE.crowd.nearZ + 1e-3);
      expect(z).toBeGreaterThanOrEqual(SCENE.crowd.farZ - 1e-3);
    }
  });

  it('pickFocusIndex는 결정적이며 여러 사이클에 걸쳐 다양한 인물을 고른다', () => {
    expect(pickFocusIndex(3, CANDIDATES)).toBe(pickFocusIndex(3, CANDIDATES));
    const picks = new Set<number>();
    for (let c = 0; c < 12; c++) picks.add(pickFocusIndex(c, CANDIDATES));
    expect(picks.size).toBeGreaterThan(1); // 항상 같은 한 명만 고르지 않는다
    for (const p of picks) expect(CANDIDATES).toContain(p);
  });
});
