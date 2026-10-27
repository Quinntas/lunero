import { defineApp } from "convex/server"
import { v } from "convex/values"

const app = defineApp({
  env: {
    // Public URL of the web app, used by Convex Auth and Stripe redirects.
    SITE_URL: v.string(),
    // Fixed platform fee (in centavos) Lunero keeps from every accepted draft.
    LUNERO_FEE_CENTS: v.string(),
    STRIPE_SECRET_KEY: v.optional(v.string()),
    STRIPE_WEBHOOK_SECRET: v.optional(v.string()),
  },
})

export default app
