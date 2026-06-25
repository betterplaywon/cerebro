import { buildServer } from './server.js';
import { env } from './env.js';
import { getEnabledAdapters } from './sources/registry.js';

const app = buildServer();

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then((address) => {
    app.log.info(`cerebro api listening on ${address}`);
    app.log.info({ adapters: getEnabledAdapters().map((a) => a.id) }, '활성 소스 어댑터');
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
