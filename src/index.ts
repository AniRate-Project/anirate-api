/* Initialize module-alias */
import 'module-alias/register';

/* Initialize env variables */
import 'dotenv/config';

/* Import database */
import Database from '@db';

import { DiscoveryService } from '@services/DiscoveryService';
import { APIServer } from './server';

/* Connect to the database */
Database.connect().then(async() => {
  /* Eventually, clear startup cache (automatically done only in dev environment) */
  await Database.clearBootstrapCache();

  /* Start discovering new episodes */
  DiscoveryService.discover();

  /* Start server */
  new APIServer().start(parseInt(process.env.PORT) || 80);
});
