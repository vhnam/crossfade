import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';

import { Prisma } from '../../prisma/client';
import { DuplicateTenantSlugException, InvalidCredentialException } from '../exceptions/business.exception';
import { GlobalExceptionFilter } from './global-exception.filter';

function hostWithResponse() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const response = { status };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps InvalidCredentialException to 401 with the contract message', () => {
    const { host, status, json } = hostWithResponse();

    filter.catch(new InvalidCredentialException(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({
      statusCode: 401,
      message: 'Invalid or missing API credential',
    });
  });

  it('maps DuplicateTenantSlugException to 409 with the contract message', () => {
    const { host, status, json } = hostWithResponse();

    filter.catch(new DuplicateTenantSlugException(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      message: 'Tenant slug already registered',
    });
  });

  it('maps an uncaught Prisma P2002 to a generic conflict', () => {
    const { host, status, json } = hostWithResponse();
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      message: 'Resource already exists',
    });
  });

  it('hides internal detail for unknown errors', () => {
    const { host, status, json } = hostWithResponse();

    filter.catch(new Error('prisma exploded'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });
  });
});
