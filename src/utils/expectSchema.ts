import { expect } from '@playwright/test';
import type { ZodType } from 'zod';

/** Asserts a value matches a Zod schema and prints every violated field when it does not. */
export function expectSchema<T>(schema: ZodType<T>, value: unknown, label = 'response'): T {
  const result = schema.safeParse(value);
  const issues = result.success
    ? ''
    : result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
  expect(result.success, `${label} does not match the schema:\n${issues}`).toBe(true);
  return result.data as T;
}
