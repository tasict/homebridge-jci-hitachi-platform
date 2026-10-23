import { Logger } from 'homebridge';


/**
 * Decorates the Homebridge logger to only log debug messages when debug mode is enabled.
 */
export default class JciHitachiPlatformLogger {

  // Used when there is no Homebridge logger, e.g. standalone runs.
  private fallbackLogger = console;

  constructor(
    private readonly logger: Logger|undefined = undefined,
    private readonly debugMode: boolean = false,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(...messages: any[]) {

    if (this.debugMode) {
      for (let i = 0; i < messages.length; i++) {

        if(this.logger !== undefined)
          this.logger.debug(messages[i]);
        else
          this.fallbackLogger.debug(messages[i]);
        

      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info(...messages: any[]) {
    for (let i = 0; i < messages.length; i++) {
      if(this.logger !== undefined)
        this.logger.info(messages[i]);
      else
        this.fallbackLogger.info(messages[i]);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(...messages: any[]) {
    for (let i = 0; i < messages.length; i++) {
      if(this.logger !== undefined)
        this.logger.warn(messages[i]);
      else
        this.fallbackLogger.warn(messages[i]);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(...messages: any[]) {
    for (let i = 0; i < messages.length; i++) {
      if(this.logger !== undefined)
        this.logger.error(messages[i]);
      else
        this.fallbackLogger.error(messages[i]);
    }
  }
}
