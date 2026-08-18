export {};

declare global {
  function describe(name: string, fn: () => void): void;
  function it(name: string, fn: () => Promise<void> | void): void;
  function beforeAll(fn: () => Promise<void> | void): void;
  function afterAll(fn: () => Promise<void> | void): void;

  const expect: {
    (actual: unknown): {
      toBe(expected: unknown): void;
      toEqual(expected: unknown): void;
      toMatch(expected: RegExp | string): void;
      toBeDefined(): void;
      toHaveProperty(key: string): void;
      not: {
        toBe(expected: unknown): void;
        toHaveProperty(key: string): void;
      };
    };
  };

  const jest: {
    mock(moduleName: string, factory?: () => unknown): void;
  };
}
