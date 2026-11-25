import { z } from 'zod';

/** Zod contracts for the GraphQL responses. `.strict()` makes unexpected extra fields fail the test. */

export const PageInfoSchema = z
  .object({
    count: z.number().int().nonnegative().nullable(),
    pages: z.number().int().nonnegative().nullable(),
    next: z.number().int().positive().nullable(),
    prev: z.number().int().positive().nullable(),
  })
  .strict();

export const CharacterSchema = z
  .object({
    id: z.string().regex(/^\d+$/),
    name: z.string().min(1),
    status: z.enum(['Alive', 'Dead', 'unknown']),
    species: z.string().min(1),
    type: z.string(),
    gender: z.enum(['Female', 'Male', 'Genderless', 'unknown']),
    image: z.url(),
    created: z.iso.datetime(),
  })
  .strict();

export const CharacterDetailsSchema = CharacterSchema.extend({
  origin: z
    .object({
      id: z.string().nullable(),
      name: z.string(),
      type: z.string().nullable(),
      dimension: z.string().nullable(),
    })
    .strict(),
  location: z.object({ id: z.string().nullable(), name: z.string() }).strict(),
  episode: z
    .array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          episode: z.string().regex(/^S\d{2}E\d{2}$/),
        })
        .strict(),
    )
    .min(1),
}).strict();

export const LocationSchema = z
  .object({
    id: z.string().regex(/^\d+$/),
    name: z.string().min(1),
    type: z.string(),
    dimension: z.string(),
    created: z.iso.datetime(),
    residents: z.array(z.object({ id: z.string(), name: z.string() }).strict()),
  })
  .strict();

export const EpisodeSchema = z
  .object({
    id: z.string().regex(/^\d+$/),
    name: z.string().min(1),
    air_date: z.string().min(1),
    episode: z.string().regex(/^S\d{2}E\d{2}$/),
    created: z.iso.datetime(),
    characters: z.array(z.object({ id: z.string(), name: z.string() }).strict()).min(1),
  })
  .strict();

export const GraphQLErrorSchema = z.object({
  message: z.string().min(1),
  locations: z.array(z.object({ line: z.number(), column: z.number() })).optional(),
  extensions: z.object({ code: z.string() }).optional(),
});
