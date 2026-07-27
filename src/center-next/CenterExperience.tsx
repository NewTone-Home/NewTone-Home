import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { copy } from '../i18n/copy'
import { useProgressStore } from '../stores/progressStore'
import { useTransitionStore } from '../stores/transitionStore'
import type { CenterDefinition } from './domain/contracts'
import { resolveCenterWorld } from './domain/worldResolver'
import { resolveCenterReadState } from './domain/readState'
import { getLocalizedCenterText } from './content/defaultCenterDefinition'
import { centerContentService } from './content/CenterContentService'
import { CenterDeveloperTools } from './CenterDeveloperTools'
import { CenterReadRail } from './shell/CenterReadRail'
import { CenterModuleRail } from './shell/CenterModuleRail'
import { shellCopy, t as shellText } from './shell/shellCopy'
import './CenterExperience.css'

type MapRegion = {
  id: string
  name: string
  summary: string
  detail: string
  points: string
}

const MAP_REGIONS: MapRegion[] = [
  {
    id: 'old-town',
    name: '老城区',
    summary: '城市最早形成的区域，旧街、旧渠与近代生活层层叠合。',
    detail: '这里保留着城市最深的时间纹理。姬家祖宅只是其中一个入口，未来还可以继续加入老街、学校、戏院与地下通道，而不需要改动第一层地图。',
    points: '92,118 492,82 558,198 555,518 438,671 214,662 86,507',
  },
  {
    id: 'central-core',
    name: '中央核心区',
    summary: '道路、广场与公共机构组成城市最有秩序的中心。',
    detail: '这一层只说明中央核心区的位置与性格。中枢院及其他机构会在进入城区后的第二层出现。',
    points: '505,98 899,96 932,202 908,618 799,704 514,660 462,518 488,214',
  },
  {
    id: 'south-life',
    name: '南部生活区',
    summary: '住宅、学校与日常设施构成更舒缓的城市生活面。',
    detail: '这里承载普通人的生活节奏。后续可以增加住宅街、学校、公园或其他故事入口。',
    points: '226,620 491,569 803,635 845,741 744,913 357,902 211,792',
  },
  {
    id: 'riverside-new',
    name: '滨江新区',
    summary: '高层建筑与新道路沿江展开，代表城市较新的生长方向。',
    detail: '新区在第一层只保持整体轮廓。进入第二层后，才显示具体建筑、地点和事件。',
    points: '927,167 1185,185 1257,302 1219,548 1092,589 930,510',
  },
  {
    id: 'riverbank',
    name: '江岸片区',
    summary: '公园、步道和公共空间沿水岸形成开放的城市边缘。',
    detail: '江岸片区更偏公共空间与日常活动。它可以持续增加新地点，而不必重新绘制总览地图。',
    points: '927,520 1095,559 1219,548 1268,770 1150,920 857,926 846,746',
  },
]

function CenterExperience() {
  const language = useProgressStore((state: any) => state.language) as keyof typeof copy
  const packageId = useProgressStore((state: any) => state.centerContentPackageId)
  const committedLocation = useProgressStore((state: any) => state.committedLocation)
  const furthestLocation = useProgressStore((state: any) => state.furthestLocation)
  const worldSnapshot = useProgressStore((state: any) => state.centerWorldSnapshot)
  const setWorld = useProgressStore((state: any) => state.setCenterWorldSnapshot)
  const transitionTo = useTransitionStore((state: any) => state.transitionTo)
  const notifyTargetReady = useTransitionStore((state: any) => state.notifyTargetReady)

  const [definition, setDefinition] = useState<CenterDefinition | null>(null)
  const [loadError, setLoadError] = useState('')
  const [imageReady, setImageReady] = useState(false)
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null)
  const [previewRegionId, setPreviewRegionId] = useState<string | null>(null)
  const [detailRegionId, setDetailRegionId] = useState<string | null>(null)
  const [enteredRegionId, setEnteredRegionId] = useState<string | null>(null)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const hoverTimerRef = useRef<number | null>(null)

  const mapUrl = `${import.meta.env.BASE_URL}assets/center/center-city-map-lineart-v1.webp`
  const t = copy[language]

  useEffect(() => {
    let cancelled = false
    setDefinition(null)
    setLoadError('')

    void centerContentService.loadDefinition(packageId)
      .then(nextDefinition => {
        if (cancelled) return
        const progress = useProgressStore.getState()
        setWorld(resolveCenterWorld({
          definition: nextDefinition,
          committedLocation: progress.committedLocation,
          furthestLocation: progress.furthestLocation,
          visitedLandmarkIds: progress.centerWorldSnapshot?.visitedLandmarkIds,
        }))
        setDefinition(nextDefinition)
        notifyTargetReady('center')
      })
      .catch(error => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : '世界中枢载入失败')
        notifyTargetReady('center')
      })

    return () => {
      cancelled = true
    }
  }, [committedLocation, furthestLocation, notifyTargetReady, packageId, setWorld])

  useEffect(() => () => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current)
  }, [])

  const activePreview = useMemo(
    () => MAP_REGIONS.find(region => region.id === previewRegionId) ?? null,
    [previewRegionId],
  )
  const activeDetail = useMemo(
    () => MAP_REGIONS.find(region => region.id === detailRegionId) ?? null,
    [detailRegionId],
  )
  const enteredRegion = useMemo(
    () => MAP_REGIONS.find(region => region.id === enteredRegionId) ?? null,
    [enteredRegionId],
  )

  // Shell 左栏的只读状态。地名与段落位置全部由 domain 解析,Shell 不持有文本表。
  const readState = useMemo(
    () => definition
      ? resolveCenterReadState({ definition, committedLocation, furthestLocation, snapshot: worldSnapshot })
      : null,
    [committedLocation, definition, furthestLocation, worldSnapshot],
  )

  const clearHoverTimer = useCallback(() => {
    if (!hoverTimerRef.current) return
    window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }, [])

  const beginRegionHover = useCallback((regionId: string) => {
    clearHoverTimer()
    setHoveredRegionId(regionId)
    if (detailRegionId) return
    hoverTimerRef.current = window.setTimeout(() => {
      setPreviewRegionId(regionId)
      hoverTimerRef.current = null
    }, 720)
  }, [clearHoverTimer, detailRegionId])

  const endRegionHover = useCallback((regionId: string) => {
    clearHoverTimer()
    setHoveredRegionId(current => current === regionId ? null : current)
  }, [clearHoverTimer])

  const selectRegion = useCallback((regionId: string) => {
    clearHoverTimer()
    setHoveredRegionId(regionId)
    setPreviewRegionId(regionId)
  }, [clearHoverTimer])

  const openDetail = useCallback((regionId: string) => {
    setPreviewRegionId(regionId)
    setDetailRegionId(regionId)
  }, [])

  const enterRegion = useCallback((regionId: string) => {
    setEnteredRegionId(regionId)
    setDetailRegionId(null)
  }, [])

  const returnLanding = useCallback(() => {
    transitionTo('landing', { preset: 'core-to-surface' })
  }, [transitionTo])

  const continueReader = useCallback(() => {
    transitionTo('reader', { preset: 'core-to-reader', payload: { mode: 'continue' } })
  }, [transitionTo])

  const closeDetail = useCallback(() => setDetailRegionId(null), [])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (event.deltaY < 36) return
    const regionId = detailRegionId ?? previewRegionId
    if (!regionId) return
    event.preventDefault()
    enterRegion(regionId)
  }, [detailRegionId, enterRegion, previewRegionId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (enteredRegionId) setEnteredRegionId(null)
      else if (detailRegionId) closeDetail()
      else setPreviewRegionId(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeDetail, detailRegionId, enteredRegionId])

  if (loadError) {
    return (
      <main className="center-next center-next--error">
        <h1>世界中枢暂时没有展开</h1>
        <p>{loadError}</p>
        <button type="button" onClick={continueReader}>{t.continueReading}</button>
      </main>
    )
  }

  if (!definition) {
    return <main className="center-next center-next--loading">正在展开城市手稿…</main>
  }

  return (
    <main
      className="center-next center-next--static-map"
      data-runtime-ready="true"
      data-map-image-ready={imageReady ? 'true' : 'false'}
      data-hovered-region={hoveredRegionId ?? ''}
      onWheel={handleWheel}
    >
      <header className="center-next-header">
        <button type="button" onClick={returnLanding}>{t.backToLanding}</button>
        <p>
          {getLocalizedCenterText(definition.title, language)}
          <span aria-hidden="true"> · </span>
          <em>{shellText(shellCopy.breadcrumbMap, language)}</em>
        </p>
        <button type="button" onClick={continueReader}>{t.continueReading}</button>
      </header>

      {readState && <CenterReadRail readState={readState} language={language} />}

      {/* 中央视口：Shell 的唯一动态区域。地图、后续的档案/图鉴/成就都发生在这里。 */}
      <div className="center-shell-viewport">
      <section
        className="center-map-stage"
        aria-label="城市分区地图"
        onPointerMove={event => setPointer({ x: event.clientX, y: event.clientY })}
        onPointerDown={event => {
          if (event.target === event.currentTarget) {
            setPreviewRegionId(null)
            closeDetail()
          }
        }}
      >
        <img
          className="center-map-image"
          src={mapUrl}
          alt="NewTone 城市手绘地图"
          onLoad={() => setImageReady(true)}
          onError={() => setImageReady(true)}
          draggable={false}
        />
        <svg
          className="center-map-regions"
          viewBox="0 0 1280 960"
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="城市分区"
        >
          {MAP_REGIONS.map(region => (
            <polygon
              key={region.id}
              className="center-map-region"
              data-active={previewRegionId === region.id || detailRegionId === region.id}
              points={region.points}
              tabIndex={0}
              role="button"
              aria-label={region.name}
              onPointerEnter={() => beginRegionHover(region.id)}
              onPointerLeave={() => endRegionHover(region.id)}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation()
                selectRegion(region.id)
              }}
              onDoubleClick={() => openDetail(region.id)}
              onFocus={() => selectRegion(region.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openDetail(region.id)
                }
              }}
            />
          ))}
        </svg>
      </section>

      {activePreview && !activeDetail && !enteredRegion && (
        <button
          type="button"
          className="center-map-preview"
          onClick={() => openDetail(activePreview.id)}
        >
          <strong>{activePreview.name}</strong>
          <span>{activePreview.summary}</span>
          <small>点击查看 · 向下进入</small>
        </button>
      )}

      {activeDetail && !enteredRegion && (
        <aside className="center-next-detail" aria-label={activeDetail.name} onPointerDown={event => {
          if (event.target === event.currentTarget) closeDetail()
        }}>
          <div className="center-next-detail-sheet">
            <p>城市分区</p>
            <h2>{activeDetail.name}</h2>
            <article>{activeDetail.detail}</article>
            <footer>
              <button type="button" onClick={() => enterRegion(activeDetail.id)}>进入这一层</button>
              <button type="button" onClick={closeDetail}>收起</button>
            </footer>
          </div>
        </aside>
      )}

      {enteredRegion && (
        <section className="center-region-placeholder" aria-label={`${enteredRegion.name}第二层`}>
          <button type="button" onClick={() => setEnteredRegionId(null)}>返回城市地图</button>
          <div>
            <p>城区第二层 · 占位验收</p>
            <h1>{enteredRegion.name}</h1>
            <span>{enteredRegion.detail}</span>
            <small>下一阶段在这里接入地点插图、地点入口与故事内容。</small>
          </div>
        </section>
      )}
      </div>

      <CenterModuleRail language={language} />

      {hoveredRegionId && !previewRegionId && (
        <div className="center-map-hover-progress" style={{ left: pointer.x, top: pointer.y }} aria-hidden="true">
          <span />
        </div>
      )}

      <CenterDeveloperTools />
    </main>
  )
}

export default CenterExperience
