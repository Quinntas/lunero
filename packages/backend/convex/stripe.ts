"use node"

import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import Stripe from "stripe"
import { internal } from "./_generated/api"
import { fail } from "./lib/errors"
import type { Id } from "./_generated/dataModel"
import { action, env, internalAction } from "./_generated/server"
import type { ActionCtx } from "./_generated/server"

const PIX_EXPIRES_AFTER_SECONDS = 60 * 60

function stripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    fail("payments.unavailable")
  }
  return new Stripe(env.STRIPE_SECRET_KEY)
}

function siteUrl(path: string) {
  return new URL(path, env.SITE_URL).toString()
}

/** Contractor pays the full contract value up front (card or Pix, BRL). */
export const createCheckout = action({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, { contractId }): Promise<{ url: string }> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) fail("auth.required")
    const { contract, contractorEmail } = await ctx.runQuery(internal.contracts.getForCheckout, {
      contractId,
      userId,
    })
    const stripe = stripeClient()

    // Reuse a still-open session so a contractor never gets charged twice.
    if (contract.stripeCheckoutSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(contract.stripeCheckoutSessionId)
      if (existing.status === "open" && existing.url) return { url: existing.url }
      if (existing.status === "complete") {
        fail("contract.paymentInProgress")
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "brl",
      // Filters the methods enabled in the Stripe Dashboard: enable Pix there too.
      allowed_payment_method_types: ["card", "pix"],
      payment_method_options: { pix: { expires_after_seconds: PIX_EXPIRES_AFTER_SECONDS } },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: contract.totalCents,
            product_data: {
              name: `Lunero · ${contract.title}`,
              ...(contract.description ? { description: contract.description.slice(0, 500) } : {}),
            },
          },
        },
      ],
      ...(contractorEmail ? { customer_email: contractorEmail } : {}),
      client_reference_id: contract._id,
      metadata: { contractId: contract._id },
      payment_intent_data: {
        transfer_group: contract._id,
        metadata: { contractId: contract._id },
      },
      success_url: siteUrl(`/app/contracts/${contract._id}?checkout=success`),
      cancel_url: siteUrl(`/app/contracts/${contract._id}?checkout=cancelled`),
    })
    if (!session.url) fail("payments.checkoutFailed")
    await ctx.runMutation(internal.contracts.setCheckoutSession, {
      contractId: contract._id,
      sessionId: session.id,
    })
    return { url: session.url }
  },
})

/** Starts (or resumes) Stripe Connect onboarding so a freelancer can receive payouts. */
export const createConnectOnboarding = action({
  args: {},
  handler: async (ctx): Promise<{ url: string }> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) fail("auth.required")
    const user = await ctx.runQuery(internal.users.getInternal, { userId })
    if (!user?.isFreelancer) fail("draft.freelancerModeRequired")
    const stripe = stripeClient()

    let accountId = user.stripeAccountId
    if (!accountId) {
      const account = await stripe.accounts.create({
        country: "BR",
        ...(user.email ? { email: user.email } : {}),
        controller: {
          stripe_dashboard: { type: "express" },
          fees: { payer: "application" },
          losses: { payments: "application" },
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { userId },
      })
      accountId = account.id
      await ctx.runMutation(internal.users.setStripeAccount, {
        userId,
        stripeAccountId: accountId,
        payoutsEnabled: false,
      })
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: siteUrl("/app/settings?stripe=refresh"),
      return_url: siteUrl("/app/settings?stripe=return"),
    })
    return { url: link.url }
  },
})

/** Refreshes the freelancer's Connect status (called when they return from onboarding). */
export const syncConnectAccount = action({
  args: {},
  handler: async (ctx): Promise<{ payoutsEnabled: boolean }> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) fail("auth.required")
    const user = await ctx.runQuery(internal.users.getInternal, { userId })
    if (!user?.stripeAccountId) return { payoutsEnabled: false }
    return await syncAccount(ctx, userId, user.stripeAccountId)
  },
})

async function syncAccount(ctx: ActionCtx, userId: Id<"users">, accountId: string) {
  const account = await stripeClient().accounts.retrieve(accountId)
  const payoutsEnabled = account.capabilities?.transfers === "active"
  await ctx.runMutation(internal.users.setStripeAccount, {
    userId,
    stripeAccountId: accountId,
    payoutsEnabled,
  })
  if (payoutsEnabled) {
    await ctx.runMutation(internal.milestones.retryBlockedForFreelancer, { userId })
  }
  return { payoutsEnabled }
}

/** Moves an approved milestone's share from the platform balance to the freelancer. */
export const releaseMilestone = internalAction({
  args: { milestoneId: v.id("milestones") },
  handler: async (ctx, { milestoneId }): Promise<void> => {
    const data = await ctx.runQuery(internal.milestones.getForPayout, { milestoneId })
    if (!data) return
    const { milestone, contract, freelancer } = data
    if (milestone.status !== "approved" || milestone.payoutStatus !== "pending") return

    const block = (error: string): Promise<null> =>
      ctx.runMutation(internal.milestones.setPayoutResult, {
        milestoneId,
        result: { status: "blocked", error },
      })
    if (!contract.stripeChargeId) {
      await block("payout.chargeMissing")
      return
    }
    if (!freelancer.stripeAccountId || !freelancer.stripePayoutsEnabled) {
      await block("payout.onboardingRequired")
      return
    }

    try {
      const transfer = await stripeClient().transfers.create(
        {
          amount: milestone.payoutCents,
          currency: "brl",
          destination: freelancer.stripeAccountId,
          source_transaction: contract.stripeChargeId,
          transfer_group: contract._id,
          description: `Lunero · ${contract.title} · ${milestone.name}`,
          metadata: { contractId: contract._id, milestoneId },
        },
        { idempotencyKey: `lunero-milestone-${milestoneId}` },
      )
      await ctx.runMutation(internal.milestones.setPayoutResult, {
        milestoneId,
        result: { status: "paid", transferId: transfer.id },
      })
    } catch (error) {
      await ctx.runMutation(internal.milestones.setPayoutResult, {
        milestoneId,
        result: {
          status: "failed",
          error: error instanceof Error ? error.message : "Falha ao criar a transferência",
        },
      })
    }
  },
})

export const handleWebhook = internalAction({
  args: { payload: v.string(), signature: v.string() },
  handler: async (ctx, { payload, signature }): Promise<{ ok: boolean; error?: string }> => {
    if (!env.STRIPE_WEBHOOK_SECRET) return { ok: false, error: "Webhook secret not configured" }
    const stripe = stripeClient()
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Invalid signature" }
    }

    const isNew = await ctx.runMutation(internal.stripeEvents.record, {
      eventId: event.id,
      type: event.type,
    })
    if (!isNew) return { ok: true }

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object
        const contractId = session.metadata?.contractId as Id<"contracts"> | undefined
        if (!contractId) break
        if (session.payment_status !== "paid") {
          await ctx.runMutation(internal.contracts.markPaymentProcessing, {
            contractId,
            sessionId: session.id,
          })
          break
        }
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id
        if (!paymentIntentId) break
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
        const chargeId =
          typeof paymentIntent.latest_charge === "string"
            ? paymentIntent.latest_charge
            : paymentIntent.latest_charge?.id
        if (!chargeId) break
        await ctx.runMutation(internal.contracts.markFunded, {
          contractId,
          sessionId: session.id,
          paymentIntentId,
          chargeId,
        })
        break
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const contractId = event.data.object.metadata?.contractId as Id<"contracts"> | undefined
        if (!contractId) break
        await ctx.runMutation(internal.contracts.markPaymentFailed, {
          contractId,
          reason: event.type === "checkout.session.expired" ? "expired" : "pixFailed",
        })
        break
      }
      case "account.updated": {
        const account = event.data.object
        const userId = account.metadata?.userId as Id<"users"> | undefined
        if (userId) await syncAccount(ctx, userId, account.id)
        break
      }
    }
    return { ok: true }
  },
})
