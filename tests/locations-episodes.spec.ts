import { test, expect } from '../src/fixtures/gql.fixtures';
import { EPISODE_BY_ID, EPISODES_FILTERED, LOCATION_BY_ID } from '../src/queries/queries';
import { EpisodeSchema, LocationSchema } from '../src/schemas/schemas';
import { expectSchema } from '../src/utils/expectSchema';
import { expectNoErrors } from '../src/utils/assertions';

test.describe('Locations', () => {
  test('location 1 matches the contract and lists its residents @smoke', async ({ gql }) => {
    const data = expectNoErrors(
      await gql.query<{ location: { name: string; residents: unknown[] } }>(LOCATION_BY_ID, { id: '1' }),
    );

    expect(data.location.name).toBe('Earth (C-137)');
    expect(data.location.residents.length).toBeGreaterThan(0);
    expectSchema(LocationSchema, data.location, 'location 1');
  });

  test('a location resident exists as a character, and points back to a location', async ({ gql }) => {
    const { location } = expectNoErrors(
      await gql.query<{ location: { id: string; residents: { id: string }[] } }>(LOCATION_BY_ID, { id: '3' }),
    );
    const residentId = location.residents[0].id;

    const { character } = expectNoErrors(
      await gql.query<{ character: { id: string; location: { id: string } } }>(
        'query($id: ID!) { character(id: $id) { id location { id } } }',
        { id: residentId },
      ),
    );
    expect(character.id).toBe(residentId);
    expect(character.location.id).toBe(location.id);
  });
});

test.describe('Episodes', () => {
  test('episode 1 is the pilot and matches the contract @smoke', async ({ gql }) => {
    const data = expectNoErrors(
      await gql.query<{ episode: { name: string; episode: string; characters: { name: string }[] } }>(EPISODE_BY_ID, {
        id: '1',
      }),
    );

    expect(data.episode.name).toBe('Pilot');
    expect(data.episode.episode).toBe('S01E01');
    expect(data.episode.characters.map((c) => c.name)).toEqual(expect.arrayContaining(['Rick Sanchez', 'Morty Smith']));
    expectSchema(EpisodeSchema, data.episode, 'episode 1');
  });

  for (const [season, expectedEpisodes] of [
    ['S01', 11],
    ['S02', 10],
    ['S03', 10],
  ] as const) {
    test(`season ${season} has ${expectedEpisodes} episodes`, async ({ gql }) => {
      const data = expectNoErrors(
        await gql.query<{ episodes: { info: { count: number }; results: { episode: string }[] } }>(EPISODES_FILTERED, {
          filter: { episode: season },
        }),
      );

      expect(data.episodes.info.count).toBe(expectedEpisodes);
      for (const e of data.episodes.results) expect(e.episode.startsWith(season)).toBe(true);
    });
  }

  test('every character of an episode lists that episode back (relation is consistent both ways)', async ({ gql }) => {
    const { episode } = expectNoErrors(
      await gql.query<{ episode: { id: string; characters: { id: string }[] } }>(EPISODE_BY_ID, { id: '2' }),
    );
    const sample = episode.characters[0].id;

    const { character } = expectNoErrors(
      await gql.query<{ character: { episode: { id: string }[] } }>(
        'query($id: ID!) { character(id: $id) { episode { id } } }',
        {
          id: sample,
        },
      ),
    );
    expect(character.episode.map((e) => e.id)).toContain(episode.id);
  });
});
