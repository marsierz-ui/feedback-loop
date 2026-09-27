import { Hono } from 'hono'
import type { Bindings } from './env.js'
import { handleFeedback } from './routes/feedback.js'
import { handleCreateProject, handleListProjects } from './routes/projects.js'
import { handleCreateRoutingRule, handleListRoutingRules } from './routes/routingRules.js'
import { handleListProviderCredentials, handleSetProviderCredential } from './routes/providerCredentials.js'

export const app = new Hono<{ Bindings: Bindings }>()

// /feedback is called cross-origin from the widget on arbitrary host pages.
// The API key (not Origin) is the real gate — see db/schema.sql's
// api_keys comment — so this reflects the caller's origin rather than
// enforcing a strict allowlist; projects.widget_origin is reserved for a
// future stricter mode.
app.options('/feedback', (c) =>
  new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': c.req.header('origin') ?? '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    },
  }),
)
app.use('/feedback', async (c, next) => {
  await next()
  c.res.headers.set('Access-Control-Allow-Origin', c.req.header('origin') ?? '*')
})

app.post('/feedback', handleFeedback)

app.post('/projects', handleCreateProject)
app.get('/projects', handleListProjects)

app.post('/projects/:projectId/routing-rules', handleCreateRoutingRule)
app.get('/projects/:projectId/routing-rules', handleListRoutingRules)

app.put('/projects/:projectId/credentials/:provider', handleSetProviderCredential)
app.get('/projects/:projectId/credentials', handleListProviderCredentials)

export default app
