import { HttpException, HttpStatus } from '@nestjs/common';

export abstract class BusinessException extends HttpException {
  constructor(status: HttpStatus, message: string) {
    super(message, status);
  }
}

export class InvalidCredentialException extends BusinessException {
  constructor(message = 'Invalid or missing API credential') {
    super(HttpStatus.UNAUTHORIZED, message);
  }
}

export class TenantSuspendedException extends BusinessException {
  constructor(message = 'Tenant is suspended') {
    super(HttpStatus.FORBIDDEN, message);
  }
}

export class DuplicateTenantSlugException extends BusinessException {
  constructor(message = 'Tenant slug already registered') {
    super(HttpStatus.CONFLICT, message);
  }
}

export class TenantNotFoundException extends BusinessException {
  constructor(message = 'Tenant not found') {
    super(HttpStatus.NOT_FOUND, message);
  }
}
