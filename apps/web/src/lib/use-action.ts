import { useState } from "react"
import { toast } from "sonner"
import { useI18n } from "@/i18n"

/** Wraps an async call with a pending flag and success / error toasts. */
export function useAction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  success?: string,
) {
  const { errorMessage } = useI18n()
  const [pending, setPending] = useState(false)
  const run = async (...args: A): Promise<R | undefined> => {
    setPending(true)
    try {
      const result = await fn(...args)
      if (success) toast.success(success)
      return result
    } catch (error) {
      toast.error(errorMessage(error))
      return undefined
    } finally {
      setPending(false)
    }
  }
  return [run, pending] as const
}
