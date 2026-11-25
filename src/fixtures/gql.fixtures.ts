import { test as base, expect } from '@playwright/test';
import { GraphQLClient } from '../graphql/GraphQLClient';
import { GRAPHQL_PATH } from '../../playwright.config';

export const test = base.extend<{ gql: GraphQLClient }>({
  gql: async ({ request }, use) => {
    await use(new GraphQLClient(request, GRAPHQL_PATH));
  },
});

export { expect };
