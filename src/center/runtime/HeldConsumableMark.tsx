import './HeldConsumableMark.css'
import type { HeldConsumablePresentation, HeldConsumableVisualKind } from './heldConsumablePresentation'

const categoryLabel: Record<HeldConsumableVisualKind, string> = {
  coffee: '咖啡',
  'milk-tea': '奶茶',
  'fruit-drink': '果茶',
  food: '食物',
  unknown: '物品',
}

/** Small category cue for the item already carried by the player; it does not consume the item. */
export function HeldConsumableMark({ item }: { item: HeldConsumablePresentation }) {
  const label = categoryLabel[item.visualKind]
  return (
    <span className={`held-consumable-mark held-consumable-mark--${item.visualKind}`} aria-label={`手持${label}`} title={label}>
      <svg className="held-consumable-mark__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {item.visualKind === 'coffee' || item.visualKind === 'milk-tea' || item.visualKind === 'fruit-drink' ? (
          <>
            <path d="M6 7h11l-1 13H7L6 7Z" />
            <path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17M9 4v2m4-3v3" />
            {item.visualKind === 'milk-tea' ? <circle cx="10" cy="16" r=".7" /> : null}
            {item.visualKind === 'fruit-drink' ? <path d="M12 3c2 1 2.5 2.5 1.4 3.4-1.2.8-2.8-.2-1.4-3.4Z" /> : null}
          </>
        ) : item.visualKind === 'food' ? (
          <>
            <path d="M4 12h15a7.5 7.5 0 0 1-15 0Zm-1 0h17M7 20h10" />
            <path d="M8 8c0-1 .8-1.4.8-2.5M12 8c0-1 .8-1.4.8-2.5M16 8c0-1 .8-1.4.8-2.5" />
          </>
        ) : <path d="M5 5h14v14H5zM8 9h8M8 13h8M8 16h5" />}
      </svg>
      <span className="held-consumable-mark__label">{label}</span>
    </span>
  )
}
