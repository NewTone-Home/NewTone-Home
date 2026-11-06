export function mainlineObservationPageIsSettled(pageKey: string, settledPageKey: string | null): boolean {
  return pageKey === settledPageKey
}
