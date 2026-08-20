import { CENTER_NEWS, centerText } from '../data/centerScene'

function CenterNewsTicker({ language, label, onSelect }) {
  const items = [...CENTER_NEWS, ...CENTER_NEWS]
  return (
    <section className="center-news" aria-label={label}>
      <div className="center-news__label"><span className="center-news__pulse" />{label}</div>
      <div className="center-news__viewport">
        <div className="center-news__track">
          {items.map((item, index) => (
            <button
              key={`${item.id}-${index}`}
              type="button"
              className="center-news__item"
              tabIndex={index < CENTER_NEWS.length ? 0 : -1}
              aria-hidden={index >= CENTER_NEWS.length}
              onClick={() => onSelect(item.entityId)}
            >
              <span>{String((index % CENTER_NEWS.length) + 1).padStart(2, '0')}</span>
              {centerText(item.text, language)}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export default CenterNewsTicker

