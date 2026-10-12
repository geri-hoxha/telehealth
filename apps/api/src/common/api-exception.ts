import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * An error the app reacts to. `code` is stable and mapped to a translated message in the app;
 * `message` is for developers. `extra` adds fields such as the end of a block.
 */
export class ApiException extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, extra: Record<string, unknown> = {}) {
    super({ statusCode: status, code, message, ...extra }, status);
  }
}
