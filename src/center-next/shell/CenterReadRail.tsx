import type { CenterReadState } from '../domain/readState'
import { formatKnown, formatProgress, shellCopy, t } from './shellCopy'

type Row = {
  key: string
  label: string
  value: string
  pending?: boolean
}

/**
 * 左栏：只读阅读状态。
 * 不接受任何指针事件,不做 hover,不做焦点 —— 它是仪表,不是控件。
 */
export function CenterReadRail({
  readState,
  language,
}: {
  readState: CenterReadState
  language: string
}) {
  const progress = formatProgress(
    readState.sectionOrdinal,
    readState.sectionTotal,
    readState.beatOrdinal,
    readState.beatTotal,
    language,
  )
  const known = formatKnown(readState.knownCount, readState.visitedCount, language)

  const rows: Row[] = [
    {
      key: 'place',
      label: t(shellCopy.labelPlace, language),
      value: readState.place ? t(readState.place, language) : t(shellCopy.valueUnknownPlace, language),
      pending: !readState.place,
    },
    {
      key: 'time',
      label: t(shellCopy.labelStoryTime, language),
      value: t(shellCopy.valueTimeMissing, language),
      pending: true,
    },
    {
      key: 'progress',
      label: t(shellCopy.labelProgress, language),
      value: progress ?? t(shellCopy.valueUnknownProgress, language),
      pending: !progress,
    },
    {
      key: 'furthest',
      label: t(shellCopy.labelFurthest, language),
      value: readState.furthestPlace
        ? t(readState.furthestPlace, language)
        : t(shellCopy.valueUnknownPlace, language),
      pending: !readState.furthestPlace,
    },
    {
      key: 'known',
      label: t(shellCopy.labelKnown, language),
      value: known ?? t(shellCopy.valueKnownNone, language),
      pending: !known,
    },
    {
      key: 'character',
      label: t(shellCopy.labelCharacter, language),
      value: t(shellCopy.valueCharacterMissing, language),
      pending: true,
    },
  ]

  return (
    <aside className="center-shell-rail center-shell-rail--read" aria-label={t(shellCopy.readStateHeading, language)}>
      <p className="center-shell-rail-heading">{t(shellCopy.readStateHeading, language)}</p>
      <dl>
        {rows.map(row => (
          <div key={row.key} data-pending={row.pending ? 'true' : 'false'}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
