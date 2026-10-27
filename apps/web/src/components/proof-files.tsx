import { useAuthToken } from "@convex-dev/auth/react"
import type { Id } from "@workspace/backend/dataModel"
import { Button } from "@workspace/ui/components/button"
import { DownloadIcon, FileIcon, PaperclipIcon, XIcon } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { MAX_FILE_BYTES, createDownloadUrl, createUploadUrls } from "@/lib/files"
import { useI18n } from "@/i18n"
import { formatBytes } from "@/lib/format"

export type ProofFile = { key: string; name: string; size: number; contentType: string }

/** Uploads files straight to S3 using URLs signed by the web server. */
export function useProofUpload(milestoneId: Id<"milestones">) {
  const token = useAuthToken()
  const { t } = useI18n()
  return async (files: File[]): Promise<ProofFile[]> => {
    if (files.length === 0) return []
    if (!token) throw new Error("code:sessionExpired")
    const signed = await createUploadUrls({
      data: {
        token,
        milestoneId,
        files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
      },
    })
    return Promise.all(
      files.map(async (file, index) => {
        const target = signed[index]!
        const response = await fetch(target.url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": target.contentType },
        })
        if (!response.ok) throw new Error(t("contract.uploadFailed", { name: file.name }))
        return {
          key: target.key,
          name: file.name,
          size: file.size,
          contentType: target.contentType,
        }
      }),
    )
  }
}

export function FilePicker({
  files,
  onChange,
  max = 10,
}: {
  files: File[]
  onChange: (files: File[]) => void
  max?: number
}) {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? [])
          const tooBig = picked.filter((file) => file.size > MAX_FILE_BYTES)
          if (tooBig.length) {
            toast.error(t("contract.filesTooBig", { size: formatBytes(MAX_FILE_BYTES) }))
          }
          onChange(
            [...files, ...picked.filter((file) => file.size <= MAX_FILE_BYTES)].slice(0, max),
          )
          event.target.value = ""
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={files.length >= max}
        onClick={() => input.current?.click()}
      >
        <PaperclipIcon />
        {t("contract.attach")}
      </Button>
      {files.length ? (
        <ul className="flex flex-col gap-1">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
            >
              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{file.name}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {formatBytes(file.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`${t("editor.remove")} ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function ProofFileList({
  submissionId,
  files,
}: {
  submissionId: Id<"submissions">
  files: ProofFile[]
}) {
  const token = useAuthToken()
  const { errorMessage } = useI18n()
  const [loading, setLoading] = useState<string>()

  async function download(file: ProofFile) {
    if (!token) return
    setLoading(file.key)
    try {
      const { url } = await createDownloadUrl({ data: { token, submissionId, key: file.key } })
      window.open(url, "_blank", "noopener")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoading(undefined)
    }
  }

  if (files.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((file) => (
        <li key={file.key}>
          <Button
            variant="outline"
            size="sm"
            disabled={loading === file.key}
            onClick={() => download(file)}
          >
            <DownloadIcon />
            <span className="max-w-48 truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
          </Button>
        </li>
      ))}
    </ul>
  )
}
