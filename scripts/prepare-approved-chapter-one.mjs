import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { compileWorkspace } from '../src/admin/contentWorkspace.js'

const [, , chinesePath, englishPath, outputPath] = process.argv
if (!chinesePath || !englishPath || !outputPath) {
  throw new Error('Usage: node scripts/prepare-approved-chapter-one.mjs <zh-file> <en-file> <output-json>')
}

function normalizeLines(value) {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

function parseMarkdownDocument(value, { skipQuoteMetadata = false } = {}) {
  const lines = normalizeLines(value).split('\n')
  const titleLine = lines.shift()
  if (!titleLine?.startsWith('# ')) throw new Error('Source must begin with one Markdown H1 title.')
  if (skipQuoteMetadata) {
    while (lines[0]?.trim() === '') lines.shift()
    while (lines[0]?.startsWith('>')) lines.shift()
  }
  while (lines[0]?.trim() === '') lines.shift()
  const body = lines.join('\n').trimEnd()
  const paragraphs = body.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean)
  if (paragraphs.join('\n\n') !== body) throw new Error('Source contains unapproved paragraph-boundary whitespace normalization.')
  return { title: titleLine.slice(2), body, paragraphs }
}

const [chineseBuffer, englishBuffer] = await Promise.all([
  readFile(resolve(chinesePath)),
  readFile(resolve(englishPath)),
])
const chinese = parseMarkdownDocument(chineseBuffer.toString('utf8'))
const english = parseMarkdownDocument(englishBuffer.toString('utf8'), { skipQuoteMetadata: true })

if (chinese.paragraphs.length !== 58) throw new Error(`Expected 58 Chinese paragraphs, received ${chinese.paragraphs.length}.`)
if (english.paragraphs.length !== 59) throw new Error(`Expected 59 English paragraphs, received ${english.paragraphs.length}.`)

const translationCounts = Array.from({ length: 58 }, (_, index) => index === 38 ? 2 : 1)
const pageRanges = [
  { start: 0, end: 10, id: 'ji-ancestral-home-courtyard', zh: '姬家祖宅外院', en: 'Ji ancestral residence — courtyard', worldLayer: 'surface', time: 'unknown', weather: 'clear', light: 'neutral' },
  { start: 10, end: 19, id: 'ji-ancestral-home-hall', zh: '姬家祖宅正厅', en: 'Ji ancestral residence — main hall', worldLayer: 'surface', time: 'unknown', weather: 'unknown', light: 'interior-dim' },
  { start: 19, end: 25, id: 'hidden-passage', zh: '暗道', en: 'Hidden passage', worldLayer: 'surface', time: 'unknown', weather: 'unknown', light: 'passage-dark' },
  { start: 25, end: 32, id: 'world-concordat-office', zh: '世界联合会办公室', en: 'World Concordat office', worldLayer: 'inner', time: 'unknown', weather: 'clear', light: 'threshold-white' },
  { start: 32, end: 38, id: 'inner-shopping-district-cafe', zh: '里世界商业区咖啡店', en: 'Inner World shopping district — café', worldLayer: 'inner', time: 'unknown', weather: 'clear', light: 'threshold-white' },
  { start: 38, end: 58, id: 'inner-shopping-street', zh: '里世界商业街', en: 'Inner World shopping street', worldLayer: 'inner', time: 'unknown', weather: 'clear', light: 'threshold-white' },
]

let englishOffset = 0
const pages = pageRanges.map((range) => {
  const counts = translationCounts.slice(range.start, range.end)
  const englishLength = counts.reduce((sum, count) => sum + count, 0)
  const page = {
    id: range.id,
    sceneLabel: range.zh,
    sceneLabelEn: range.en,
    text: chinese.paragraphs.slice(range.start, range.end).join('\n\n'),
    textEn: english.paragraphs.slice(englishOffset, englishOffset + englishLength).join('\n\n'),
    translationParagraphCounts: { en: counts },
    worldLayer: range.worldLayer,
    time: range.time,
    weather: range.weather,
    light: range.light,
  }
  englishOffset += englishLength
  return page
})
if (englishOffset !== english.paragraphs.length) throw new Error('English paragraph mapping did not consume the complete source.')

const workspace = {
  schemaVersion: 1,
  chapters: [{
    id: 'xiujie-chapter-1',
    title: chinese.title,
    titleEn: english.title,
    protagonistId: 'xiujie-ji',
    pages,
  }],
}
const content = compileWorkspace(workspace)
const compiledPages = content.flatMap(phase => phase.pages)
const compiledChinese = compiledPages.flatMap(page => page.beats.flatMap(beat => beat.blocks.map(block => block.text))).join('\n\n')
const compiledEnglish = compiledPages.flatMap(page => page.beats.flatMap(beat => beat.translations.en.blocks.map(block => block.text))).join('\n\n')
if (compiledChinese !== chinese.body) throw new Error('Compiled Chinese Reader body differs from the approved source.')
if (compiledEnglish !== english.body) throw new Error('Compiled English Reader body differs from the approved source.')
const sha256 = value => createHash('sha256').update(value).digest('hex')
await writeFile(resolve(outputPath), JSON.stringify({
  workspace,
  content,
  sourceManifest: {
    chinese: { file: '修杰1.txt', sha256: sha256(chineseBuffer), normalizedBodySha256: sha256(chinese.body), paragraphs: chinese.paragraphs.length },
    english: { file: 'Xiujie_Chapter_1_EN.md', sha256: sha256(englishBuffer), normalizedBodySha256: sha256(english.body), paragraphs: english.paragraphs.length },
    normalizations: ['UTF-8 decoded', 'CRLF normalized to LF', 'H1 titles stored as chapter metadata', 'English blockquote metadata excluded from narrative body'],
  },
}, null, 2), 'utf8')

console.log(JSON.stringify({ pages: pages.length, chineseParagraphs: chinese.paragraphs.length, englishParagraphs: english.paragraphs.length }))
