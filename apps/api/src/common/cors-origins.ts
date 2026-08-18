export function parseCorsOrigins(): string[] {
  const configured = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== '*');

  return origins.length > 0 ? origins : ['http://localhost:3000'];
}
