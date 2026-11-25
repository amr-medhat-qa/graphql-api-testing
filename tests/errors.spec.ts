import { test, expect } from '../src/fixtures/gql.fixtures';
import { CHARACTER_BY_ID, CHARACTERS_PAGE } from '../src/queries/queries';
import { expectGraphQLError, expectNoErrors } from '../src/utils/assertions';

/**
 * Negative scenarios. A GraphQL server reports problems in an `errors` array; whether it also uses a non-200
 * HTTP status is a design choice. These tests pin what this API does today, including the behaviours that
 * differ from common GraphQL practice (marked QUIRK), so a change on the server shows up as a failing test.
 */
test.describe('Errors: invalid queries', () => {
  test('unknown field is rejected with GRAPHQL_VALIDATION_FAILED and the position of the problem @smoke', async ({
    gql,
  }) => {
    const result = await gql.query('{ characters { nonExistingField } }');

    expectGraphQLError(result, {
      status: 400,
      message: /Cannot query field "nonExistingField"/,
      code: 'GRAPHQL_VALIDATION_FAILED',
    });
    expect(result.body!.errors![0].locations![0].line).toBeGreaterThan(0);
  });

  test('unknown root field is rejected', async ({ gql }) => {
    expectGraphQLError(await gql.query('{ planet(id: 1) { name } }'), {
      status: 400,
      message: /Cannot query field "planet"/,
      code: 'GRAPHQL_VALIDATION_FAILED',
    });
  });

  test('missing selection on an object field is rejected', async ({ gql }) => {
    expectGraphQLError(await gql.query('{ character(id: 1) }'), {
      status: 400,
      message: /must have a selection of subfields/,
    });
  });

  // The API sits behind a gateway (Stellate). It rejects unparsable requests before they reach the GraphQL
  // server, so these errors have a different shape: no `locations`, and the code lives in `extensions.stellate`.
  for (const [name, payload] of [
    ['a syntax error', { query: '{ characters { ' }],
    ['an empty query string', { query: '' }],
    ['a request without a query', {}],
  ] as const) {
    test(`QUIRK: ${name} is rejected by the gateway with 400 and a non-standard error shape`, async ({ gql }) => {
      const result = await gql.send(payload);

      expect(result.status).toBe(400);
      const error = result.body?.errors?.[0] as { message: string; extensions?: { stellate?: { code?: string } } };
      expect(error.message).toContain('did not contain a valid GraphQL request');
      expect(error.extensions?.stellate?.code).toBe('INVALID_QUERY');
      expect(error).not.toHaveProperty('locations');
    });
  }

  test('the schema is read-only: mutations are not supported', async ({ gql }) => {
    expectGraphQLError(await gql.query('mutation { deleteCharacter(id: 1) { id } }'), {
      status: 400,
      message: /Schema is not configured for mutations/,
    });
  });
});

test.describe('Errors: invalid variables', () => {
  test('a required variable that is not sent is rejected', async ({ gql }) => {
    const result = await gql.query(CHARACTER_BY_ID);

    expectGraphQLError(result, { status: 400, message: /Variable "\$id" of required type "ID!" was not provided/ });
  });

  test('a variable of the wrong type is rejected', async ({ gql }) => {
    const result = await gql.query(CHARACTERS_PAGE, { page: 'abc' });

    expectGraphQLError(result, {
      status: 400,
      message: /Variable "\$page" got invalid value "abc"; Expected type Int/,
    });
  });

  test('QUIRK: input errors carry code INTERNAL_SERVER_ERROR (BAD_USER_INPUT would describe a client mistake)', async ({
    gql,
  }) => {
    const result = await gql.query(CHARACTER_BY_ID, { id: { nested: 1 } });

    expectGraphQLError(result, { status: 400, code: 'INTERNAL_SERVER_ERROR' });
  });
});

test.describe('Errors: valid query, nothing found', () => {
  test('QUIRK: an unknown id answers 200 with data null and NO error', async ({ gql }) => {
    const result = await gql.query<{ character: null }>(CHARACTER_BY_ID, { id: '999999' });

    expect(result.status).toBe(200);
    expect(result.body?.errors).toBeUndefined();
    expect(result.body?.data?.character).toBeNull();
  });

  test('QUIRK: a filter with no match returns an empty list and info.count null (not 0)', async ({ gql }) => {
    const data = expectNoErrors(
      await gql.query<{ characters: { info: { count: number | null }; results: unknown[] } }>(CHARACTERS_PAGE, {
        filter: { name: 'zzzzqqqq' },
      }),
    );

    expect(data.characters.results).toEqual([]);
    expect(data.characters.info.count).toBeNull();
  });

  test('QUIRK: a page beyond the last one answers 200 with an empty list', async ({ gql }) => {
    const data = expectNoErrors(
      await gql.query<{ characters: { results: unknown[] } }>(CHARACTERS_PAGE, { page: 9999 }),
    );

    expect(data.characters.results).toEqual([]);
  });
});
