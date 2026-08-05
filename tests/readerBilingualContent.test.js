import { describe, expect, it } from 'vitest'
import { getBeatBlocksForLanguage } from '../src/components/reader/ReaderBeatStack'

const beat = {
  blocks: [{ id: 'block-0', text: '中文' }],
  translations: { en: { blocks: [{ id: 'block-0', text: 'English' }, { id: 'block-1', text: 'Second paragraph' }] } },
}

describe('Reader bilingual body selection', () => {
  it('renders the selected language without mutating either narrative', () => {
    expect(getBeatBlocksForLanguage(beat, 'zh').map(block => block.text)).toEqual(['中文'])
    expect(getBeatBlocksForLanguage(beat, 'en').map(block => block.text)).toEqual(['English', 'Second paragraph'])
    expect(getBeatBlocksForLanguage(beat, 'fr').map(block => block.text)).toEqual(['中文'])
  })
})
