import { Logger } from "tslog";

export enum ErrorLogLevel {
  IGNORE,
  WARN,
  ERROR,
  FATAL
}

const mainLogger = new Logger({ name: 'main', dateTimeTimezone: 'Europe/Rome' });

const web = mainLogger.getChildLogger({ name: "web" });
const app = mainLogger.getChildLogger({ name: "app" });

export default {
  web,
  app,
  scripts: app.getChildLogger({ name: 'scripts' }),
  discovery: app.getChildLogger({ name: 'discovery' }),
  httpError: app.getChildLogger({
    name: 'httpError',
    exposeErrorCodeFrame: false,
    exposeStack: false,
    printLogMessageInNewLine: true
  })
};
