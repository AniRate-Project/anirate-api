const optionalImports = [];
async function optionalImporting() {
  for (const importable of optionalImports) {
    await import(importable);
  }
}

/* Initialize module-alias, except in dev mode */
if (process.env.NODE_ENV !== 'development') {
  optionalImports.push('module-alias/register');
}

/* Initialize env variables */
import 'dotenv/config';
