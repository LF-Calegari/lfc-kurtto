import { env } from '@config/env';

import app from './app.js';

app.listen(env.PORT, () => {
  console.log(
    `Kurtto service listening on port ${env.PORT} (${env.NODE_ENV})`,
  );
});
