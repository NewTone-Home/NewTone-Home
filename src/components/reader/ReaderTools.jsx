function ReaderTools({ language, onLanguage }) {
  return (
    <div className="reader-stage-tools" aria-label="阅读工具">
      <button type="button" onClick={onLanguage}>{language.toUpperCase()}</button>
    </div>
  )
}

export default ReaderTools
