import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { LanguagesIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { locales, useI18n } from "@/i18n"
import type { Locale } from "@/i18n"

export const localeNames: Record<Locale, string> = {
  "en-US": "English (US)",
  "pt-BR": "Português (Brasil)",
}

export function ThemeToggle() {
  const { t } = useI18n()
  const { theme = "system", setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("common.theme")}>
          <SunIcon className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <MoonIcon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("common.theme")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">{t("common.themeLight")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{t("common.themeDark")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">{t("common.themeSystem")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function LocaleSwitcher() {
  const { t, locale, setLocale } = useI18n()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("common.language")}>
          <LanguagesIcon />
          <span className="hidden sm:inline">{locale === "pt-BR" ? "PT" : "EN"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={(v) => setLocale(v as Locale)}>
          {locales.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {localeNames[value]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Inline controls used on the settings page. */
export function PreferenceControls() {
  const { t, locale, setLocale } = useI18n()
  const { theme = "system", setTheme } = useTheme()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("common.theme")}</span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={theme}
          onValueChange={(value) => value && setTheme(value)}
          className="w-fit"
        >
          <ToggleGroupItem value="light">
            <SunIcon />
            {t("common.themeLight")}
          </ToggleGroupItem>
          <ToggleGroupItem value="dark">
            <MoonIcon />
            {t("common.themeDark")}
          </ToggleGroupItem>
          <ToggleGroupItem value="system">
            <MonitorIcon />
            {t("common.themeSystem")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("common.language")}</span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={locale}
          onValueChange={(value) => value && setLocale(value as Locale)}
          className="w-fit"
        >
          {locales.map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {localeNames[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  )
}
