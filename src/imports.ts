import isProdEnv from './utils/isProdEnv';

/* Initialize module-alias, except in dev mode because we already have TS compiler's paths */
if (isProdEnv()) {
  require('module-alias/register');
}

/* Initialize env variables */
import 'dotenv/config';
