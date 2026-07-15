function ReaderTools({ language, onLanguage }) {
  return (
    <div className="reader-stage-tools" role="toolbar" aria-label="阅读工具">
      <button
        type="button"
        onClick={onLanguage}
        aria-label={`切换阅读语言，当前 ${language.toUpperCase()}`}
      >
        {language.toUpperCase()}
      </button>
    </div>
  )
}

export default ReaderTools
