import { createIsomorphicFn } from "@tanstack/react-start"
import { getCookie, getRequestHeader } from "@tanstack/react-start/server"
import { ConvexError } from "convex/values"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { en } from "./messages/en"
import { ptBR } from "./messages/pt-BR"

export const locales = ["en-US", "pt-BR"] as const
export type Locale = (typeof locales)[number]
export const LOCALE_COOKIE = "lunero-locale"

const dictionaries = { "en-US": en, "pt-BR": ptBR } as const

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]
export type MessageKey = Leaves<typeof en>
export type Params = Record<string, string | number>

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value)
}

function fromAcceptLanguage(header: string | undefined): Locale {
  return header?.toLowerCase().includes("pt") ? "pt-BR" : "en-US"
}

/** Cookie first, then the browser language. Runs on the server and the client. */
export const detectLocale = createIsomorphicFn()
  .server((): Locale => {
    const cookie = getCookie(LOCALE_COOKIE)
    return isLocale(cookie) ? cookie : fromAcceptLanguage(getRequestHeader("accept-language"))
  })
  .client((): Locale => {
    const cookie = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`))?.[1]
    return isLocale(cookie) ? cookie : fromAcceptLanguage(navigator.language)
  })

/** Walks the dictionary; leaf keys may themselves contain dots (e.g. error codes). */
function lookup(locale: Locale, key: string): string | undefined {
  let node: unknown = dictionaries[locale]
  const parts = key.split(".")
  for (let i = 0; i < parts.length; i++) {
    if (typeof node !== "object" || node === null) return undefined
    const record = node as Record<string, unknown>
    const rest = parts.slice(i).join(".")
    if (rest in record)
      return typeof record[rest] === "string" ? (record[rest] as string) : undefined
    node = record[parts[i]!]
  }
  return typeof node === "string" ? node : undefined
}

function interpolate(message: string, params?: Params) {
  if (!params) return message
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  )
}

function createFormatters(locale: Locale) {
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" })
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" })
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ]
  return {
    money: (cents: number) => money.format(cents / 100),
    date: (ms: number) => date.format(ms),
    dateTime: (ms: number) => dateTime.format(ms),
    relative: (ms: number) => {
      const diff = ms - Date.now()
      for (const [unit, size] of units) {
        if (Math.abs(diff) >= size) return relative.format(Math.round(diff / size), unit)
      }
      return relative.format(0, "minute")
    },
  }
}

function createI18n(locale: Locale) {
  const format = createFormatters(locale)
  const t = (key: MessageKey, params?: Params) =>
    interpolate(lookup(locale, key) ?? lookup("en-US", key) ?? key, params)
  /** Translates a key that is only known at runtime (status values, codes…). */
  const tDynamic = (key: string, params?: Params, fallback?: string) => {
    const message = lookup(locale, key) ?? lookup("en-US", key)
    return message ? interpolate(message, params) : (fallback ?? key)
  }
  /** Turns any thrown error into a translated, user-facing message. */
  const errorMessage = (error: unknown) => {
    let code: string | undefined
    let params: Params = {}
    if (error instanceof ConvexError && typeof error.data === "object" && error.data?.code) {
      ;({ code, ...params } = error.data as { code: string } & Params)
    } else if (error instanceof Error) {
      code = error.message.match(/code:([\w.]+)/)?.[1]
    }
    if (typeof params.amountCents === "number") params.amount = format.money(params.amountCents)
    return code ? tDynamic(`errors.${code}`, params, t("errors.generic")) : t("errors.generic")
  }
  return { locale, t, tDynamic, errorMessage, ...format }
}

export type I18n = ReturnType<typeof createI18n> & { setLocale: (locale: Locale) => void }

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale
  children: ReactNode
}) {
  const [locale, setLocaleState] = useState(initialLocale)

  const setLocale = useCallback((next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    setLocaleState(next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo(() => ({ ...createI18n(locale), setLocale }), [locale, setLocale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error("useI18n must be used inside <I18nProvider>")
  return context
}
