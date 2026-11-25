# GraphQL API Testing

[![GraphQL API Tests](https://github.com/amr-medhat-qa/graphql-api-testing/actions/workflows/api-tests.yml/badge.svg)](https://github.com/amr-medhat-qa/graphql-api-testing/actions/workflows/api-tests.yml)
[![Live report](https://img.shields.io/badge/report-live-2ea44f?logo=playwright&logoColor=white)](https://amr-medhat-qa.github.io/graphql-api-testing/)
![GraphQL](https://img.shields.io/badge/GraphQL-E10098?logo=graphql&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-4-3E67B1?logo=zod&logoColor=white)

Automated tests for the public [Rick and Morty GraphQL API](https://rickandmortyapi.com/graphql), written with **Playwright Test**,
**TypeScript** and **Zod** contracts, and run in **GitHub Actions** on every push, on pull requests and on a weekday schedule.

📊 **[Live HTML report →](https://amr-medhat-qa.github.io/graphql-api-testing/)**

## What is covered (48 tests)

| Area                 | File                                 | What it checks                                                                                                                                                                |
| -------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Queries**          | `tests/characters.spec.ts`           | query by id with **variables**, fragments, paging (`info.next/prev/pages`, no overlap between pages, last page), filters (name, status, species, combined), `charactersByIds` |
| **GraphQL features** | `tests/characters.spec.ts`           | field selection (no over-fetching), **aliases**, `@include` / `@skip` directives                                                                                              |
| **Relations**        | `tests/locations-episodes.spec.ts`   | location ⇄ residents ⇄ character, episode ⇄ characters are consistent in both directions; season filters                                                                      |
| **Contract**         | all specs                            | every response is validated with a strict **Zod schema** (an unexpected extra field fails the test)                                                                           |
| **Schema**           | `tests/schema-and-transport.spec.ts` | **introspection**: query entry points, fields of `Character` / `Location` / `Episode`, no mutations                                                                           |
| **Errors**           | `tests/errors.spec.ts`               | invalid field, syntax error, missing or wrongly typed variables, mutation on a read-only schema, nothing found                                                                |
| **Transport**        | `tests/schema-and-transport.spec.ts` | POST and GET, JSON content type, response-time budget (`MAX_RESPONSE_MS`)                                                                                                     |

## Findings (documented, not hidden)

A GraphQL server reports problems in an `errors` array, and each API makes its own choices about HTTP status and error shape.
These behaviours differ from common GraphQL practice. Each one has a test marked `QUIRK` that pins the **current** behaviour, so the suite
is green today and **fails the day the API changes**, which is the signal to review the expectation.

| Behaviour                                                                                                                                                                               | What a client would expect                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| An unknown id (`character(id: 999999)`) answers `200` with `data: null` and **no error**                                                                                                | an error, or at least a clear "not found"                |
| A filter with no match returns `results: []` and `info.count: null`                                                                                                                     | `count: 0`                                               |
| A page beyond the last one answers `200` with an empty list                                                                                                                             | an error or the last page                                |
| Wrong variable types and missing variables answer `400` with code `INTERNAL_SERVER_ERROR`                                                                                               | `BAD_USER_INPUT`, a client mistake is not a server error |
| Syntax errors, empty queries and requests without a query are rejected by the **gateway** in front of the API with a different error shape (`extensions.stellate.code`, no `locations`) | the standard `errors[].locations` / `extensions.code`    |
| `charactersByIds` does **not** keep the order of the ids that were sent (always sorted by id)                                                                                           | the requested order                                      |

## How the project is organised

```
├── src/
│   ├── graphql/GraphQLClient.ts   one place that sends queries (POST/GET), measures time, retries infrastructure hiccups
│   ├── queries/queries.ts         the GraphQL documents (query strings, fragments)
│   ├── schemas/schemas.ts         Zod contracts for Character, Location, Episode, page info and errors
│   ├── utils/                     expectSchema, expectNoErrors, expectGraphQLError
│   └── fixtures/gql.fixtures.ts   Playwright fixture that gives each test a ready client
├── tests/                         characters · locations-episodes · errors · schema-and-transport
└── .github/                       workflows/api-tests.yml · dependabot.yml
```

Two helpers keep the tests short and readable: `expectNoErrors(result)` (HTTP 200, no `errors`, data present) and
`expectGraphQLError(result, { status, message, code })` (well-formed error with the expected status, message and code).

## Run it

Needs Node.js 18 or newer.

```bash
npm ci
```

```bash
npm test
```

| Command              | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `npm test`           | all tests, HTML report in `playwright-report/` |
| `npm run test:smoke` | only the tests tagged `@smoke`                 |
| `npm run report`     | opens the last HTML report                     |
| `npm run check`      | type check + lint + format check               |

Settings can be changed with environment variables, for example `MAX_RESPONSE_MS=1000 npm test` or `BASE_URL=https://staging.example.com npm test`.

### Why one worker and a retry in the client

The API is a **free public service** behind a rate-limiting gateway. Sending many requests at once makes it reset connections or answer
with an HTML error page. That was seen while building the suite (23 of 48 tests failed with 4 parallel workers), and again on the shared GitHub runner
(one test got `429 Too Many Requests`). So the tests run with **one worker**, requests are spaced 250 ms apart,
and the client retries **only infrastructure hiccups** (connection reset, `429`, `5xx`, HTML instead of JSON) up to 6 times,
waiting as long as the server asks (`Retry-After`) or with a growing delay.
A real GraphQL answer, including a `400` with an error, is never retried or hidden.

## CI

`api-tests.yml` runs the type check, lint and format check first, then the tests, uploads the HTML and JUnit reports as an artifact and,
on `main`, publishes them to **GitHub Pages**. Dependabot opens weekly update PRs for npm packages and GitHub Actions.

## Author

**Amr Medhat** — Senior QA Engineer · [GitHub](https://github.com/amr-medhat-qa) · [LinkedIn](https://www.linkedin.com/in/amr-medhat-wafeek)
