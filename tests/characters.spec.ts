import { test, expect } from '../src/fixtures/gql.fixtures';
import { CHARACTER_BY_ID, CHARACTERS_BY_IDS, CHARACTERS_PAGE } from '../src/queries/queries';
import { CharacterDetailsSchema, CharacterSchema, PageInfoSchema } from '../src/schemas/schemas';
import { expectSchema } from '../src/utils/expectSchema';
import { expectNoErrors } from '../src/utils/assertions';

interface CharacterData {
  character: { id: string; name: string; species: string; episode: { episode: string }[] } | null;
}
interface CharactersData {
  characters: {
    info: { count: number | null; pages: number | null; next: number | null; prev: number | null };
    results: { id: string; name: string; status: string }[];
  };
}

test.describe('Characters: query by id', () => {
  test('returns Rick Sanchez with all fields matching the contract @smoke', async ({ gql }) => {
    const data = expectNoErrors(await gql.query<CharacterData>(CHARACTER_BY_ID, { id: '1' }));

    expect(data.character?.name).toBe('Rick Sanchez');
    expect(data.character?.species).toBe('Human');
    expectSchema(CharacterDetailsSchema, data.character, 'character 1');
  });

  for (const [id, name] of [
    ['2', 'Morty Smith'],
    ['3', 'Summer Smith'],
    ['4', 'Beth Smith'],
    ['5', 'Jerry Smith'],
  ] as const) {
    test(`character ${id} is ${name}`, async ({ gql }) => {
      const data = expectNoErrors(await gql.query<CharacterData>(CHARACTER_BY_ID, { id }));
      expect(data.character?.name).toBe(name);
      expectSchema(CharacterDetailsSchema, data.character, `character ${id}`);
    });
  }

  test('episode codes of a character follow the SxxExx format', async ({ gql }) => {
    const data = expectNoErrors(await gql.query<CharacterData>(CHARACTER_BY_ID, { id: '1' }));
    expect(data.character!.episode.length).toBeGreaterThan(10);
    for (const ep of data.character!.episode) expect(ep.episode).toMatch(/^S\d{2}E\d{2}$/);
  });
});

test.describe('Characters: lists, filters and paging', () => {
  test('first page has 20 characters and consistent paging info @smoke', async ({ gql }) => {
    const data = expectNoErrors(await gql.query<CharactersData>(CHARACTERS_PAGE, { page: 1 }));
    const { info, results } = data.characters;

    expect(results).toHaveLength(20);
    expectSchema(PageInfoSchema, info, 'info');
    expect(info.prev).toBeNull();
    expect(info.next).toBe(2);
    expect(info.count).toBeGreaterThanOrEqual(800);
    expect(info.pages).toBe(Math.ceil(info.count! / 20));
    for (const character of results) expectSchema(CharacterSchema, character, `character ${character.id}`);
  });

  test('page 2 continues where page 1 ended, without overlap', async ({ gql }) => {
    const first = expectNoErrors(await gql.query<CharactersData>(CHARACTERS_PAGE, { page: 1 })).characters;
    const second = expectNoErrors(await gql.query<CharactersData>(CHARACTERS_PAGE, { page: 2 })).characters;

    expect(second.info.prev).toBe(1);
    expect(second.info.next).toBe(3);
    const firstIds = new Set(first.results.map((c) => c.id));
    expect(second.results.every((c) => !firstIds.has(c.id))).toBe(true);
  });

  test('the last page has no next page', async ({ gql }) => {
    const first = expectNoErrors(await gql.query<CharactersData>(CHARACTERS_PAGE, { page: 1 })).characters;
    const last = expectNoErrors(
      await gql.query<CharactersData>(CHARACTERS_PAGE, { page: first.info.pages }),
    ).characters;

    expect(last.info.next).toBeNull();
    expect(last.info.prev).toBe(first.info.pages! - 1);
    expect(last.results.length).toBeGreaterThan(0);
  });

  test('name filter is case-insensitive and every result matches', async ({ gql }) => {
    const data = expectNoErrors(
      await gql.query<CharactersData>(CHARACTERS_PAGE, { filter: { name: 'MoRtY' } }),
    ).characters;

    expect(data.results.length).toBeGreaterThan(0);
    for (const c of data.results) expect(c.name.toLowerCase()).toContain('morty');
  });

  for (const status of ['alive', 'dead', 'unknown']) {
    test(`status filter "${status}" returns only that status`, async ({ gql }) => {
      const data = expectNoErrors(await gql.query<CharactersData>(CHARACTERS_PAGE, { filter: { status } })).characters;

      expect(data.results.length).toBeGreaterThan(0);
      for (const c of data.results) expect(c.status.toLowerCase()).toBe(status);
    });
  }

  test('combined filters narrow the result (name + status + species)', async ({ gql }) => {
    const data = expectNoErrors(
      await gql.query<CharactersData>(CHARACTERS_PAGE, {
        filter: { name: 'rick', status: 'alive', species: 'human' },
      }),
    ).characters;

    expect(data.results.length).toBeGreaterThan(0);
    for (const c of data.results) {
      expect(c.name.toLowerCase()).toContain('rick');
      expect(c.status).toBe('Alive');
    }
  });

  test('charactersByIds returns exactly the requested characters (order is NOT preserved: sorted by id)', async ({
    gql,
  }) => {
    const data = expectNoErrors(
      await gql.query<{ charactersByIds: { id: string; name: string }[] }>(CHARACTERS_BY_IDS, { ids: ['2', '1', '3'] }),
    );

    expect(data.charactersByIds.map((c) => c.id)).toEqual(['1', '2', '3']);
  });
});

test.describe('Characters: GraphQL features', () => {
  test('returns only the fields that were asked for (no over-fetching)', async ({ gql }) => {
    const result = await gql.query<{ character: Record<string, unknown> }>('{ character(id: 1) { name } }');
    const data = expectNoErrors(result);

    expect(Object.keys(data.character)).toEqual(['name']);
  });

  test('aliases let one request fetch two characters', async ({ gql }) => {
    const data = expectNoErrors(
      await gql.query<{ rick: { name: string }; morty: { name: string } }>(
        '{ rick: character(id: 1) { name } morty: character(id: 2) { name } }',
      ),
    );

    expect(data.rick.name).toBe('Rick Sanchez');
    expect(data.morty.name).toBe('Morty Smith');
  });

  test('inline variables and @include / @skip directives change the response shape', async ({ gql }) => {
    const query = `query($withOrigin: Boolean!, $withLocation: Boolean!) {
      character(id: 1) { name origin @include(if: $withOrigin) { name } location @skip(if: $withLocation) { name } }
    }`;
    const data = expectNoErrors(
      await gql.query<{ character: Record<string, unknown> }>(query, { withOrigin: true, withLocation: true }),
    );

    expect(data.character).toHaveProperty('origin');
    expect(data.character).not.toHaveProperty('location');
  });

  test('the same query with different variables returns different data', async ({ gql }) => {
    const a = expectNoErrors(await gql.query<CharacterData>(CHARACTER_BY_ID, { id: '1' }));
    const b = expectNoErrors(await gql.query<CharacterData>(CHARACTER_BY_ID, { id: '2' }));

    expect(a.character?.name).not.toBe(b.character?.name);
  });
});
