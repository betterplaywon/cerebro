/**
 * 히어로(시작 인물) 텍스처 — 사용자 제공 고품질 이미지가 있으면 그것을, 없으면 절차적 플레이스홀더를 쓴다.
 * three는 lazy 씬 서브트리인 이 파일에서만 import되므로 엔트리 번들에 영향 없다.
 */
import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * src/assets/hero/ 에 놓인 이미지 한 장을 빌드 타임에 감지해 URL로 돌려준다(없으면 null).
 * import.meta.glob는 정적 분석되어, 파일을 넣고 빌드/HMR하면 자동 반영된다(코드 수정 불필요).
 */
export function resolveHeroAssetUrl(): string | null {
  const matches = import.meta.glob('../../assets/hero/*.{png,jpg,jpeg,webp,avif}', {
    eager: true,
    query: '?url',
    import: 'default',
  }) as Record<string, string>;
  const urls = Object.values(matches);
  return urls[0] ?? null;
}

/**
 * 고품질 에셋이 없을 때의 절차적 플레이스홀더 — 캡슐 피규어 대신 그라데이션 음영 + 시안 림라이트의
 * "신비로운 인물" 실루엣(상반신 흉상). 풀컬러로 그려 본 씬의 탈색/디졸브 연출을 그대로 받는다.
 */
export function makeHeroPlaceholderTexture(): CanvasTexture {
  const w = 512;
  const h = 768;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D 컨텍스트를 만들 수 없습니다');
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;

  // 흉상 실루엣 경로(머리 + 목 + 어깨)
  const figure = new Path2D();
  figure.moveTo(cx - 150, h); // 왼쪽 아래
  figure.bezierCurveTo(cx - 160, h - 230, cx - 120, h - 300, cx - 70, h - 330); // 왼 어깨 → 목
  figure.bezierCurveTo(cx - 60, h - 360, cx - 60, h - 380, cx - 64, h - 400); // 목 왼
  // 머리(원형 근사)
  figure.bezierCurveTo(cx - 110, h - 430, cx - 110, h - 560, cx, h - 560);
  figure.bezierCurveTo(cx + 110, h - 560, cx + 110, h - 430, cx + 64, h - 400); // 머리 오른
  figure.bezierCurveTo(cx + 60, h - 380, cx + 60, h - 360, cx + 70, h - 330); // 목 오른
  figure.bezierCurveTo(cx + 120, h - 300, cx + 160, h - 230, cx + 150, h); // 오른 어깨 → 아래
  figure.closePath();

  // 본체: 세로 그라데이션(위 슬레이트 → 아래 네이비)
  const body = ctx.createLinearGradient(0, h - 560, 0, h);
  body.addColorStop(0, '#33405e');
  body.addColorStop(0.55, '#1d2740');
  body.addColorStop(1, '#0c1322');
  ctx.fillStyle = body;
  ctx.fill(figure);

  // 좌측 가장자리 시안 림라이트(클립 후 오프셋 스트로크 + 글로우)
  ctx.save();
  ctx.clip(figure);
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(124, 246, 255, 0.85)';
  ctx.shadowColor = 'rgba(124, 246, 255, 0.9)';
  ctx.shadowBlur = 26;
  ctx.translate(-9, -4);
  ctx.stroke(figure);
  // 우측 약한 보조광(보라/블루)
  ctx.translate(20, 8);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(110, 168, 255, 0.5)';
  ctx.shadowColor = 'rgba(110, 168, 255, 0.6)';
  ctx.shadowBlur = 18;
  ctx.stroke(figure);
  ctx.restore();

  // 머리 안쪽 미세 하이라이트(입체감)
  const hi = ctx.createRadialGradient(cx - 36, h - 500, 6, cx - 36, h - 500, 130);
  hi.addColorStop(0, 'rgba(190, 220, 255, 0.28)');
  hi.addColorStop(1, 'rgba(190, 220, 255, 0)');
  ctx.save();
  ctx.clip(figure);
  ctx.fillStyle = hi;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
