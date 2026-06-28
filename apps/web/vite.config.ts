/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * index.html의 `%SITE_URL%`을 빌드시 사이트 절대 URL로 치환한다(OG/트위터 카드·canonical용).
 * 우선순위: VITE_PUBLIC_SITE_URL → Vercel 프로덕션 URL → 빈 문자열(루트 상대경로로 degrade).
 * 도메인을 레포에 하드코딩하지 않고 빌드 env로 주입(공개 레포 자세·DEPLOYMENT 정합). ADR-0021.
 */
function siteUrlHtml(): Plugin {
  const raw =
    process.env.VITE_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '');
  const siteUrl = raw.replace(/\/$/, '');
  return {
    name: 'html-site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
  };
}

export default defineConfig({
  plugins: [react(), siteUrlHtml()],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
