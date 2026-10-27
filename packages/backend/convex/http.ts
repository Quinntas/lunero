import { httpRouter } from "convex/server"
import { internal } from "./_generated/api"
import { httpAction } from "./_generated/server"
import { auth } from "./auth"

const http = httpRouter()

auth.addHttpRoutes(http)

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature")
    if (!signature) return new Response("Missing signature", { status: 400 })
    const result = await ctx.runAction(internal.stripe.handleWebhook, {
      payload: await request.text(),
      signature,
    })
    return result.ok
      ? new Response(null, { status: 200 })
      : new Response(result.error ?? "Webhook error", { status: 400 })
  }),
})

export default http
