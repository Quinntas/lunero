import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import type { ComponentProps } from "react"
import { useI18n } from "@/i18n"

/** Cash-register style BRL input: typing digits fills the value from the cents. */
export function MoneyInput({
  value,
  onValueChange,
  ...props
}: Omit<ComponentProps<typeof InputGroupInput>, "value" | "onChange"> & {
  value: number
  onValueChange: (cents: number) => void
}) {
  const { locale } = useI18n()
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100)
  return (
    <InputGroup>
      <InputGroupAddon>R$</InputGroupAddon>
      <InputGroupInput
        inputMode="numeric"
        className="tabular-nums"
        {...props}
        value={formatted}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 11)
          onValueChange(digits ? Number.parseInt(digits, 10) : 0)
        }}
      />
    </InputGroup>
  )
}
