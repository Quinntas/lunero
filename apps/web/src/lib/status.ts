export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "muted"

export const proposalTone: Record<string, Tone> = {
  editing: "neutral",
  sent: "info",
  accepted: "success",
  rejected: "danger",
  cancelled: "muted",
}

export const contractTone: Record<string, Tone> = {
  awaiting_payment: "warning",
  payment_processing: "info",
  active: "info",
  completed: "success",
  cancelled: "muted",
}

export const milestoneTone: Record<string, Tone> = {
  pending: "neutral",
  in_progress: "info",
  submitted: "warning",
  changes_requested: "danger",
  approved: "success",
}

export const payoutTone: Record<string, Tone> = {
  none: "muted",
  pending: "info",
  blocked: "warning",
  failed: "danger",
  paid: "success",
}

export const submissionTone: Record<string, Tone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
}
