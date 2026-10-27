import { Password } from "@convex-dev/auth/providers/Password"
import { convexAuth } from "@convex-dev/auth/server"
import { ConvexError } from "convex/values"
import type { DataModel } from "./_generated/dataModel"

const password = Password<DataModel>({
  profile(params) {
    const email = String(params.email ?? "")
      .trim()
      .toLowerCase()
    if (!email.includes("@")) {
      throw new ConvexError("E-mail inválido")
    }
    const name = typeof params.name === "string" ? params.name.trim() : undefined
    return { email, ...(name ? { name } : {}) }
  },
  validatePasswordRequirements(password) {
    if (password.length < 8) {
      throw new ConvexError("A senha deve ter pelo menos 8 caracteres")
    }
  },
})

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [password],
})
