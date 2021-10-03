/* Initialize module-alias, except in dev mode */
if (process.env.NODE_ENV !== 'development') {
  require('module-alias/register');
}

/* Initialize env variables */
import 'dotenv/config';
