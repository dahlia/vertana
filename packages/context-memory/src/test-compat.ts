/**
 * Test compatibility module that provides consistent test APIs across
 * Node.js, Deno, and Bun runtimes.
 *
 * In Bun, the `node:test` polyfill has issues with `describe()`, so we
 * use `bun:test` directly when running in Bun.
 */

// deno-lint-ignore-file no-explicit-any

const isBun = "Bun" in globalThis;

interface TestOptions {
  skip?: boolean | string;
  timeout?: number;
}

interface TestFunction {
  (name: string, fn: () => void | Promise<void>): void;
  (
    name: string,
    options: TestOptions,
    fn: () => void | Promise<void>,
  ): void;
}

interface DescribeFunction {
  (name: string, fn: () => void): void;
  (name: string, options: { skip?: boolean | string }, fn: () => void): void;
}

let describe: DescribeFunction;
let it: TestFunction;

if (isBun) {
  // Use bun:test in Bun
  // @ts-ignore - bun:test is only available in Bun
  const bunTest = await import("bun:test");
  describe = ((
    name: string,
    optionsOrFn: { skip?: boolean | string } | (() => void),
    maybeFn?: () => void,
  ) => {
    if (typeof optionsOrFn === "function") {
      bunTest.describe(name, optionsOrFn);
    } else {
      const fn = maybeFn!;
      if (optionsOrFn.skip) {
        bunTest.describe.skip(name, fn);
      } else {
        bunTest.describe(name, fn);
      }
    }
  }) as DescribeFunction;

  it = ((
    name: string,
    optionsOrFn: TestOptions | (() => void | Promise<void>),
    maybeFn?: () => void | Promise<void>,
  ) => {
    if (typeof optionsOrFn === "function") {
      bunTest.it(name, optionsOrFn);
    } else {
      const fn = maybeFn!;
      const bunOptions: { timeout?: number } = {};
      if (optionsOrFn.timeout != null) {
        bunOptions.timeout = optionsOrFn.timeout;
      }
      if (optionsOrFn.skip) {
        bunTest.it.skip(name, fn);
      } else if (Object.keys(bunOptions).length > 0) {
        bunTest.it(name, fn, bunOptions);
      } else {
        bunTest.it(name, fn);
      }
    }
  }) as TestFunction;
} else {
  // Use node:test in Node.js and Deno
  const nodeTest = await import("node:test");
  describe = nodeTest.describe as any;
  it = nodeTest.it as any;
}

export { describe, it };
