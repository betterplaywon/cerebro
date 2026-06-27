import { buildServer } from './server.js';
import { env } from './env.js';
import { getEnabledAdapters } from './sources/registry.js';
import { prewarm } from './search/prewarm.js';

const app = buildServer();

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then((address) => {
    app.log.info(`cerebro api listening on ${address}`);
    app.log.info({ adapters: getEnabledAdapters().map((a) => a.id) }, '활성 소스 어댑터');

    // 시드 프리웜(ADR-0011): listen을 블로킹하지 않는 fire-and-forget. 에러는 로깅하고 삼킨다(크래시 금지).
    // 키 없으면 LLM 비용 0(폴백). 비용 트레이드오프로 기본 OFF — prewarm.ts 주석 참고.
    if (env.PREWARM_ON_START && env.ANTHROPIC_API_KEY) {
      app.log.info('시드 프리웜 시작(fire-and-forget)');
      void prewarm(app.orchestrator, app.log).catch((err) => {
        app.log.error({ err }, '프리웜 실패 — 무시하고 계속');
      });
    }
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
