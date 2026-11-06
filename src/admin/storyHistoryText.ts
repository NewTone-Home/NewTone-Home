import { commercialCafeNarrativeDialogue, commercialCafeDeliveryDialogueLine } from '../center/runtime/commercialCafeStory'
import { ruoyuCafeMeetingDialogue } from '../center/runtime/ruoyuCafeMeeting'
import { mainlineDialogueSentenceFragments } from '../center/runtime/mainlineDialogueSentenceFragments'
const units = new Map<string, readonly string[]>([
  ...commercialCafeNarrativeDialogue.lines.map(line => [line.id,mainlineDialogueSentenceFragments(line.text)] as const),
  [commercialCafeDeliveryDialogueLine.id,[commercialCafeDeliveryDialogueLine.text]],
  ...ruoyuCafeMeetingDialogue.lines.map(line => [line.id,[line.text]] as const),
])
export function resolveStoryHistoryText(evidence: {lineId?:string;sentenceIndex?:number} | undefined, eventBuild: string | null | undefined, currentBuild: string | undefined) {
 if(!evidence?.lineId || !eventBuild || eventBuild!==currentBuild)return null
 return units.get(evidence.lineId)?.[evidence.sentenceIndex??0] ?? null
}
