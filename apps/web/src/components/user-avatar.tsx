import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { initials } from "@/lib/format"

export function UserAvatar({
  user,
  className,
}: {
  user: { name: string; image?: string } | null | undefined
  className?: string
}) {
  return (
    <Avatar className={className}>
      {user?.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
      <AvatarFallback>{user ? initials(user.name) : "?"}</AvatarFallback>
    </Avatar>
  )
}
