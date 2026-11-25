import { test, expect } from '../src/fixtures/gql.fixtures';
import { MAX_RESPONSE_MS } from '../playwright.config';
import { expectNoErrors } from '../src/utils/assertions';

interface TypeInfo {
  __type: { name: string; kind: string; fields: { name: string }[] } | null;
}

test.describe('Schema (introspection)', () => {
  test('the Query type exposes exactly the documented entry points @smoke', async ({ gql }) => {
    const data = expectNoErrors(
      await gql.query<{ __schema: { queryType: { fields: { name: string }[] }; mutationType: unknown } }>(
        '{ __schema { queryType { fields { name } } mutationType { name } } }',
      ),
    );

    expect(data.__schema.queryType.fields.map((f) => f.name).sort()).toEqual(
      [
        'character',
        'characters',
        'charactersByIds',
        'episode',
        'episodes',
        'episodesByIds',
        'location',
        'locations',
        'locationsByIds',
      ].sort(),
    );
    expect(data.__schema.mutationType).toBeNull();
  });

  const expectedFields: Record<string, string[]> = {
    Character: [
      'id',
      'name',
      'status',
      'species',
      'type',
      'gender',
      'origin',
      'location',
      'image',
      'episode',
      'created',
    ],
    Location: ['id', 'name', 'type', 'dimension', 'residents', 'created'],
    Episode: ['id', 'name', 'air_date', 'episode', 'characters', 'created'],
  };

  for (const [typeName, fields] of Object.entries(expectedFields)) {
    test(`type ${typeName} has the expected fields`, async ({ gql }) => {
      const data = expectNoErrors(
        await gql.query<TypeInfo>('query($name: String!) { __type(name: $name) { name kind fields { name } } }', {
          name: typeName,
        }),
      );

      expect(data.__type?.kind).toBe('OBJECT');
      expect(data.__type?.fields.map((f) => f.name).sort()).toEqual([...fields].sort());
    });
  }

  test('__typename is returned on every object', async ({ gql }) => {
    const data = expectNoErrors(
      await gql.query<{ character: { __typename: string; origin: { __typename: string } } }>(
        '{ character(id: 1) { __typename origin { __typename } } }',
      ),
    );

    expect(data.character.__typename).toBe('Character');
    expect(data.character.origin.__typename).toBe('Location');
  });
});

test.describe('Transport', () => {
  test('GET with a query string works for read-only queries', async ({ gql }) => {
    const data = expectNoErrors(await gql.get<{ character: { name: string } }>('{ character(id: 1) { name } }'));

    expect(data.character.name).toBe('Rick Sanchez');
  });

  test('the response is JSON', async ({ request }) => {
    const response = await request.post('/graphql', { data: { query: '{ character(id: 1) { name } }' } });

    expect(response.headers()['content-type']).toContain('application/json');
  });

  test(`a simple query answers within ${MAX_RESPONSE_MS} ms @smoke`, async ({ gql }) => {
    const result = await gql.query('{ character(id: 1) { name } }');

    expectNoErrors(result);
    expect(result.durationMs, `took ${result.durationMs} ms`).toBeLessThan(MAX_RESPONSE_MS);
  });

  test('a heavy query (a whole page with nested relations) still answers within the budget', async ({ gql }) => {
    const result = await gql.query(
      `{ characters(page: 1) { results { name origin { name } location { name } episode { name } } } }`,
    );

    expectNoErrors(result);
    expect(result.durationMs, `took ${result.durationMs} ms`).toBeLessThan(MAX_RESPONSE_MS);
  });
});
