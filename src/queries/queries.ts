/** GraphQL documents used by the tests, kept in one place so tests read as scenarios. */

export const CHARACTER_FIELDS = /* GraphQL */ `
  fragment CharacterFields on Character {
    id
    name
    status
    species
    type
    gender
    image
    created
  }
`;

export const CHARACTER_BY_ID = /* GraphQL */ `
  query CharacterById($id: ID!) {
    character(id: $id) {
      ...CharacterFields
      origin {
        id
        name
        type
        dimension
      }
      location {
        id
        name
      }
      episode {
        id
        name
        episode
      }
    }
  }
  ${CHARACTER_FIELDS}
`;

export const CHARACTERS_PAGE = /* GraphQL */ `
  query Characters($page: Int, $filter: FilterCharacter) {
    characters(page: $page, filter: $filter) {
      info {
        count
        pages
        next
        prev
      }
      results {
        ...CharacterFields
      }
    }
  }
  ${CHARACTER_FIELDS}
`;

export const CHARACTERS_BY_IDS = /* GraphQL */ `
  query CharactersByIds($ids: [ID!]!) {
    charactersByIds(ids: $ids) {
      id
      name
    }
  }
`;

export const LOCATION_BY_ID = /* GraphQL */ `
  query LocationById($id: ID!) {
    location(id: $id) {
      id
      name
      type
      dimension
      created
      residents {
        id
        name
      }
    }
  }
`;

export const EPISODE_BY_ID = /* GraphQL */ `
  query EpisodeById($id: ID!) {
    episode(id: $id) {
      id
      name
      air_date
      episode
      created
      characters {
        id
        name
      }
    }
  }
`;

export const EPISODES_FILTERED = /* GraphQL */ `
  query Episodes($page: Int, $filter: FilterEpisode) {
    episodes(page: $page, filter: $filter) {
      info {
        count
        pages
      }
      results {
        id
        name
        episode
      }
    }
  }
`;
