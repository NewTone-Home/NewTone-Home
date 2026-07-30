import { useEffect } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PlaceStageDefinition } from './placeStageTypes'

/**
 * 地点信息层。
 *
 * 产品结构上的三条硬要求，本轮即使内容是占位也必须先成立：
 * 1. 点击主体地点**不进入 Reader**；
 * 2. 它是覆盖在舞台之上的半屏层，不是右下角的小卡片；
 * 3. 它不把整体重新排成 dashboard 两栏 —— 舞台仍在下面，只是轻微后退。
 *
 * 宽度 clamp(32rem, 46%, 48rem)：小屏不至于挤成一条，大屏不至于铺满。
 */

interface PlaceInfoPanelProps {
  place: PlaceStageDefinition | null
  open: boolean
  onClose: () => void
}

export function PlaceInfoPanel({ place, open, onClose }: PlaceInfoPanelProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!place) return null

  const handleBackdropPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div
      className="pstage-info-backdrop"
      data-open={open ? 'true' : 'false'}
      onPointerDown={handleBackdropPointerDown}
      aria-hidden={open ? undefined : 'true'}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 19,
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <aside
        className="pstage-info"
        data-open={open ? 'true' : 'false'}
        aria-hidden={open ? undefined : 'true'}
        aria-label={`${place.title} 信息层`}
        role="dialog"
        aria-modal="true"
        onPointerDown={event => event.stopPropagation()}
      >
        <header className="pstage-info-head">
          <div>
            <strong>{place.title}</strong>
            {place.subtitle && <span>{place.subtitle}</span>}
          </div>
          <button type="button" className="pstage-info-close" onClick={onClose} aria-label="关闭信息层">
            收起
          </button>
        </header>

        <div className="pstage-info-body">
          <p className="pstage-info-note">
            Phase 0.5 结构占位。这一层验证的是尺寸、层级与进入方式，不是内容。
          </p>

          <dl className="pstage-info-meta">
            <div>
              <dt>世界层</dt>
              <dd>{place.worldLayer === 'surface' ? '表世界' : '里世界'}</dd>
            </div>
            <div>
              <dt>舞台资产</dt>
              <dd>{place.stageEnabled ? '已具备' : '未定 · 走降级表述'}</dd>
            </div>
            <div>
              <dt>图层组</dt>
              <dd>
                {(['rear', 'inner', 'subject', 'foreground'] as const)
                  .filter(slot => place.layers[slot]?.length)
                  .join(' · ')}
              </dd>
            </div>
          </dl>

          <div className="pstage-info-slot">正文、事件与进入入口在后续阶段接入</div>
        </div>
      </aside>
    </div>
  )
}
