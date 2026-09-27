import { z } from 'zod'

export const contextSchema = z.looseObject({
  url: z.string().max(2000),
  viewport: z.object({ w: z.number(), h: z.number() }),
  userAgent: z.string().max(1000),
  browser: z.string().max(100),
  os: z.string().max(100),
  timestamp: z.string().max(100),
  timezone: z.string().max(100).nullish(),
  language: z.string().max(50).nullish(),
  referrer: z.string().max(2000).nullish(),
})

const plainText = (max: number) =>
  z.string().max(max).transform((s) => s.replace(/[<>]/g, '').trim()).nullish()

export const reporterSchema = z
  .object({
    name: plainText(120),
    login: plainText(120),
  })
  .nullish()

export const feedbackSubmissionSchema = z.object({
  type: z.enum(['bug', 'feature']).default('bug'),
  reporter: reporterSchema,
  description: z.string().trim().min(1, 'description is required').max(10000),
  screenshot: z.string().nullish(),
  context: contextSchema,
  bugCategory: z.string().max(100).nullish(),
  expectedBehavior: z.string().max(10000).nullish(),
  stepsToReproduce: z.string().max(10000).nullish(),
  frequency: z.string().max(50).nullish(),
  impact: z.string().max(50).nullish(),
  problemStatement: z.string().max(10000).nullish(),
  priority: z.string().max(50).nullish(),
})

export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>
