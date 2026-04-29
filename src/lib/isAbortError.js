export function isAbortError(error) {
  const message = String(error?.message ?? "");
  const hint = String(error?.hint ?? "");

  return (
    error?.name === "AbortError" ||
    error?.code === "ABORT_ERR" ||
    message.startsWith("AbortError:") ||
    message.includes("signal is aborted") ||
    hint.includes("Request was aborted")
  );
}
