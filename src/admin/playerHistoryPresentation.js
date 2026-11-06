export function groupWebVisits(items) {
  const groups=new Map()
  for(const row of items){
    const id=row.event_data?.webVisitId
    const key=id?`${row.visitor_id}:${id}`:`legacy:${row.visitor_id}:${row.session_id}`
    if(!groups.has(key))groups.set(key,{key,id:id??null,visitorId:row.visitor_id,items:[],lastKnownAt:null,status:'unknown'})
    const group=groups.get(key);group.items.push(row)
    const at=row.event_data?.lastKnownAt ?? Date.parse(row.occurred_at)
    if(group.lastKnownAt===null || at>=group.lastKnownAt){group.lastKnownAt=at;group.status=row.event_data?.status ?? group.status}
  }
  return [...groups.values()].map(group=>({...group,items:group.items.sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at)||a.sequence-b.sequence)}))
}
export function dialogueEvidence(row) {
  const show=value=>value?`${value.lineId} / 第${(value.sentenceIndex??0)+1}句${value.pageIndex===undefined?' / 容量页未知':` / 第${value.pageIndex+1}页`}`:'未知'
  return {shown:show(row.event_data?.lastShown),confirmed:show(row.event_data?.lastConfirmed)}
}
