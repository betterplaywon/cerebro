import { describe, expect, it } from 'vitest';
import { fitCameraDistance } from './camera';

/**
 * 카메라 프레이밍: three.js fov는 세로 화각이므로, 세로 화면(aspect<1)에서는
 * 가로 화각이 좁아져 더 멀리서 담아야 그래프가 잘리지 않는다(모바일 잘림 회귀 방지).
 */
describe('fitCameraDistance', () => {
  const FOV = 55;
  const RADIUS = 10;

  it('가로 화면(aspect>1)은 세로 화각이 거리를 지배한다', () => {
    const distance = fitCameraDistance(RADIUS, FOV, 2);
    const vHalf = (FOV * Math.PI) / 360;
    expect(distance).toBeCloseTo(RADIUS / Math.sin(vHalf), 5);
  });

  it('정사각(aspect=1)은 가로=세로 화각으로 동일 거리', () => {
    const distance = fitCameraDistance(RADIUS, FOV, 1);
    const half = (FOV * Math.PI) / 360;
    expect(distance).toBeCloseTo(RADIUS / Math.sin(half), 5);
  });

  it('세로 화면(aspect<1)은 가로 화각이 좁아 더 멀리서 담는다', () => {
    const landscape = fitCameraDistance(RADIUS, FOV, 1.6);
    const portrait = fitCameraDistance(RADIUS, FOV, 0.5);
    expect(portrait).toBeGreaterThan(landscape);
  });

  it('종횡비가 좁아질수록 거리는 단조 증가한다', () => {
    const wide = fitCameraDistance(RADIUS, FOV, 0.9);
    const narrow = fitCameraDistance(RADIUS, FOV, 0.45);
    const narrower = fitCameraDistance(RADIUS, FOV, 0.3);
    expect(narrow).toBeGreaterThan(wide);
    expect(narrower).toBeGreaterThan(narrow);
  });

  it('margin은 거리를 선형 배수로 키운다', () => {
    const base = fitCameraDistance(RADIUS, FOV, 1);
    expect(fitCameraDistance(RADIUS, FOV, 1, 1.2)).toBeCloseTo(base * 1.2, 5);
  });

  it('반경에 비례한다', () => {
    const r1 = fitCameraDistance(5, FOV, 0.6);
    const r2 = fitCameraDistance(10, FOV, 0.6);
    expect(r2).toBeCloseTo(r1 * 2, 5);
  });
});
