import { ConvexError } from "convex/values"

/**
 * Every user-facing error is a stable code (plus optional params) so the web
 * app can translate it. Keep in sync with `errors` in the web app messages.
 */
export type ErrorCode =
  | "auth.required"
  | "user.notFound"
  | "profile.nameRequired"
  | "draft.notFound"
  | "draft.selfInvite"
  | "draft.counterpartNotFound"
  | "draft.freelancerModeRequired"
  | "draft.counterpartNotFreelancer"
  | "draft.freelancerDisabled"
  | "draft.notEditable"
  | "draft.notSendable"
  | "draft.cannotAccept"
  | "draft.cannotReject"
  | "draft.cannotCounter"
  | "draft.cannotCancel"
  | "draft.linkTaken"
  | "draft.titleRequired"
  | "draft.titleTooLong"
  | "draft.descriptionTooLong"
  | "draft.minTotal"
  | "draft.noMilestones"
  | "draft.tooManyMilestones"
  | "milestone.nameRequired"
  | "milestone.nameTooLong"
  | "milestone.descriptionTooLong"
  | "milestone.priceInvalid"
  | "milestone.etaInvalid"
  | "contract.notFound"
  | "contract.cancelOnlyUnpaid"
  | "contract.onlyContractorPays"
  | "contract.notAwaitingPayment"
  | "contract.notActive"
  | "contract.paymentInProgress"
  | "milestone.notFound"
  | "milestone.onlyFreelancer"
  | "milestone.onlyContractor"
  | "milestone.alreadyStarted"
  | "milestone.notAcceptingSubmissions"
  | "milestone.emptySubmission"
  | "milestone.noteTooLong"
  | "milestone.tooManyFiles"
  | "milestone.nothingToReview"
  | "milestone.reviewNoteRequired"
  | "milestone.noPayoutPending"
  | "file.invalid"
  | "file.notFound"
  | "payments.unavailable"
  | "payments.checkoutFailed"

export type ErrorData = { code: ErrorCode } & Record<string, string | number>

export function fail(code: ErrorCode, params: Record<string, string | number> = {}): never {
  throw new ConvexError<ErrorData>({ ...params, code })
}
