import { expect } from '@playwright/test';
import type { GraphQLResult } from '../graphql/GraphQLClient';
import { GraphQLErrorSchema } from '../schemas/schemas';
import { expectSchema } from './expectSchema';

/** A successful GraphQL call: HTTP 200, a data object, and no `errors` array. */
export function expectNoErrors<T>(result: GraphQLResult<T>): T {
  expect(result.status, `HTTP status. Body: ${result.rawBody.slice(0, 300)}`).toBe(200);
  expect(result.body?.errors, 'errors array').toBeUndefined();
  expect(result.body?.data, 'data').toBeTruthy();
  return result.body!.data as T;
}

/** A failed GraphQL call: expected HTTP status, one or more well-formed errors, optional message/code match. */
export function expectGraphQLError(
  result: GraphQLResult,
  expected: { status: number; message?: RegExp; code?: string },
): void {
  expect(result.status, `HTTP status. Body: ${result.rawBody.slice(0, 300)}`).toBe(expected.status);
  const errors = result.body?.errors;
  expect(errors, 'errors array').toBeDefined();
  expect(errors!.length).toBeGreaterThan(0);
  for (const error of errors!) expectSchema(GraphQLErrorSchema, error, 'GraphQL error');
  if (expected.message) expect(errors![0].message).toMatch(expected.message);
  if (expected.code) expect(errors![0].extensions?.code).toBe(expected.code);
  expect(result.body?.data, 'data must not carry results next to a validation error').toBeUndefined();
}
