import { resolveStoryHistoryText } from './storyHistoryText'
import { historyEnabled } from '../services/playerHistory.js'
import { groupWebVisits, dialogueEvidence } from './playerHistoryPresentation.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { listMainlineAnalyticsInteractionPoints } from '../center/runtime/mainlineAnalyticsInteractionCatalog'
import { loadPlayerHistory, loadReleaseAnalytics } from './centerAnalyticsService'
const names = new Map(listMainlineAnalyticsInteractionPoints().map(point=>[point.objectId,point.label]))
const results = {completed:'完成',cancelled:'取消',interrupted:'中断',blocked:'未能互动','story-completed':'剧情完成','order-submitted':'已下单','order-collected':'已领取','item-consumed':'已消费'}
const seconds = value => (Number(value ?? 0)/1000).toFixed(1)
const stamp = value => new Date(value).toISOString().replace('T',' ').slice(0,19)+' UTC'
function describe(row) {
  if(row.event_name==='web_visit_state')return `网页访问状态：${row.event_data.status} / ${row.event_data.reason}`
  if(row.event_name==='foreground_no_operation')return '前台无移动或操作区间'
  if(row.event_name==='business_completed')return `业务完成：${names.get(row.object_id)??row.object_id} / ${results[row.outcome]??row.outcome}`
  if(row.event_name==='gameplay_ended')return '离开游戏（网页访问继续）'
  if(row.event_name==='interaction_started')return `开始互动：${names.get(row.object_id)??row.object_id}`
  if(row.event_name==='center_object_interacted')return `${names.get(row.object_id) ?? row.object_id} · ${results[row.outcome] ?? row.outcome}`
  if(row.event_name==='center_position_sample')return `移动到 (${Number(row.position_x).toFixed(2)}, ${Number(row.position_y).toFixed(2)})`
  if(row.event_name==='session_checkpoint')return `场景前台累计 ${seconds(row.event_data.sceneForegroundMs)} 秒；无移动或输入的可能闲置 ${seconds(Math.max(0,(row.event_data.sceneForegroundMs ?? 0)-(row.event_data.sceneEngagedMs ?? 0)))} 秒`
  return {landing_entry:'打开首页',center_entry_completed:'进入游戏',center_scene_entered:'进入实际位置',center_scene_exited:'离开实际位置',session_end:'页面离开／中断'}[row.event_name] ?? row.event_name
}
export default function ReleaseAnalyticsDashboard() {
  const [environment,setEnvironment]=useState('production'),[days,setDays]=useState(7),[refresh,setRefresh]=useState(0)
  const [search,setSearch]=useState(''),[internal,setInternal]=useState('all')
  const [visitor,setVisitor]=useState(''),[visitors,setVisitors]=useState([])
  const [state,setState]=useState({loading:true}),[history,setHistory]=useState({items:[],loading:true})
  const epoch=useRef(0)
  const range=useMemo(()=>({from:new Date(Date.now()-days*86400000).toISOString(),to:new Date().toISOString(),environment}),[days,environment,refresh])
  useEffect(()=>{
    let live=true;setState({loading:true})
    loadReleaseAnalytics(range).then(data=>{if(live)setState({data})}).catch(error=>{if(live)setState({error:error.message})})
    return()=>{live=false}
  },[range])
  useEffect(()=>{
    const current=++epoch.current;setHistory({items:[],loading:true})
    loadPlayerHistory({...range,visitorId:visitor,search,internal}).then(data=>{
      if(epoch.current!==current)return
      setHistory({...data,loading:false})
      setVisitors(old=>data.players?.map(player=>player.visitor_id) ?? [...new Set([...old,...data.items.map(row=>row.visitor_id)])])
    }).catch(error=>{if(epoch.current===current)setHistory({items:[],loading:false,error:error.message})})
    return()=>{if(epoch.current===current)epoch.current++}
  },[range,visitor,search,internal])
  const earlier=async()=>{
    if(history.loading || !history.nextCursor)return
    const current=epoch.current;setHistory(old=>({...old,loading:true}))
    try{
      const data=await loadPlayerHistory({...range,visitorId:visitor,search,internal,cursor:history.nextCursor})
      if(epoch.current!==current)return
      setHistory(old=>({...data,items:[...data.items,...old.items],loading:false}))
      setVisitors(old=>data.players?.map(player=>player.visitor_id) ?? [...new Set([...old,...data.items.map(row=>row.visitor_id)])])
    }catch(error){if(epoch.current===current)setHistory(old=>({...old,loading:false,error:error.message}))}
  }
  const data=state.data
  return <section className="admin-analytics__section" aria-label="匿名玩家游玩历史">
    <h2>匿名玩家时间线 · 0.3.0</h2>
    <p>按原始历史计算整体趋势，不维护物件点击计数。历史无版本标记的数据不混入；匿名标识代表浏览器，不保证跨设备识别。</p>
    <label>环境 <select value={environment} onChange={e=>{setEnvironment(e.target.value);setVisitor('');setVisitors([])}}><option value="production">正式站</option><option value="staging">Staging</option><option value="preview">预览</option><option value="development">本地开发</option></select></label>{' '}
    <label>时段 <select value={days} onChange={e=>{setDays(Number(e.target.value));setVisitor('')}}><option value={1}>最近24小时</option><option value={7}>最近7天</option><option value={30}>最近30天</option></select></label>{' '}
    <button type="button" onClick={()=>setRefresh(n=>n+1)}>刷新历史</button>
    {state.loading && <p role="status">正在读取整体历史…</p>}{state.error && <p role="alert">{state.error}</p>}
    {data && !historyEnabled() && <>
      <p>游玩前台 {seconds(data.summary.foreground_ms)} 秒 · 有活动迹象 {seconds(data.summary.engaged_ms)} 秒 · 可能闲置 {seconds(Math.max(0,data.summary.foreground_ms-data.summary.engaged_ms))} 秒</p>
      <p>可能闲置仅指连续30秒没有移动或输入，不证明玩家离开；阅读也可能没有输入。后台不计，游戏加速时间不用于这里。检查点可能带来约15秒边界误差，强制关闭可能缺尾段。</p>
      <h3>所有玩家合并趋势（由原始检查点计算，UTC）</h3>
      <table><thead><tr><th>日期</th><th>匿名玩家</th><th>前台秒</th><th>可能闲置秒</th></tr></thead><tbody>{(data.daily ?? []).map(day=><tr key={day.day}><td>{day.day.slice(0,10)}</td><td>{day.players}</td><td>{seconds(day.foreground_ms)}</td><td>{seconds(Math.max(0,day.foreground_ms-day.engaged_ms))}</td></tr>)}</tbody></table>
      <details><summary>场景／房间停留（由同一历史计算）</summary><table><thead><tr><th>实际位置</th><th>前台秒</th><th>可能闲置秒</th></tr></thead><tbody>{(data.locations ?? []).map(row=><tr key={`${row.scene_id}:${row.room_id}`}><td>{row.scene_id} / {row.room_id}</td><td>{seconds(row.foreground_ms)}</td><td>{seconds(Math.max(0,row.foreground_ms-row.engaged_ms))}</td></tr>)}</tbody></table></details>
    </>}
    <h3>按发生时间排列的历史与移动轨迹</h3>
    {historyEnabled() && <><label>搜索匿名玩家 <input value={search} maxLength={36} onChange={e=>{setSearch(e.target.value);setVisitor('')}} placeholder="匿名ID前缀" /></label>{' '}<label>测试标记 <select value={internal} onChange={e=>setInternal(e.target.value)}><option value="all">全部（含未知）</option><option value="external">非内部测试</option><option value="internal">内部测试</option><option value="unknown">历史未知</option></select></label></>}
    <label>玩家 <select value={visitor} onChange={e=>setVisitor(e.target.value)}><option value="">所有匿名玩家合并</option>{visitors.map(id=><option key={id} value={id}>{id}</option>)}</select></label>
    <p>每页500条，按时间从早到晚；可继续加载更早记录。坐标是已有低频抽样，不是每一步。互动包含整段对白与选项，瞬时或未知时长留空。</p>
    {history.error && <p role="alert">{history.error}</p>}{history.loading && <p role="status">正在读取时间线…</p>}
    {history.nextCursor && <button type="button" disabled={history.loading} onClick={earlier}>加载更早历史</button>}
    {historyEnabled() && <section aria-label="网页访问分组">
      <p>同一标签页刷新续接同一次访问；后台只是状态。离开信号不能证明关闭，停止上报只表示结束未确认，最后时间是已知下界。历史无访问标记的记录单列，不补造。</p>
      <h3>全部匿名玩家的网页前台时长趋势（当前测试标记筛选，非500条样本求和）</h3>
      <table><thead><tr><th>UTC日期</th><th>玩家</th><th>网页前台秒</th><th>互动结束</th><th>剧情完成</th><th>前台无操作秒</th></tr></thead><tbody>{(history.daily??[]).map(day=><tr key={day.day}><td>{day.day.slice(0,10)}</td><td>{day.players}</td><td>{seconds(day.foreground_ms)}</td><td>{day.interactions}</td><td>{day.story_completions}</td><td>{seconds(day.no_operation_ms)}</td></tr>)}</tbody></table>
      <details><summary>实际场景／房间停留（当前筛选，来自原始轨迹）</summary><ul>{(history.locations??[]).map(item=><li key={`${item.scene_id}:${item.room_id}`}>{item.scene_id} / {item.room_id}：{seconds(item.foreground_ms)}秒</li>)}</ul></details>
      {groupWebVisits(history.items).map(visit=><details key={visit.key} open><summary>{visit.visitorId} · 网页访问 {visit.id??'历史未知'} · 最近状态 {({foreground:'前台',background:'后台','end-unconfirmed':'已收到离开信号，结束未确认'})[visit.status]??'结束未确认'} · 最后已知 {stamp(visit.lastKnownAt)}</summary>
        <ol>{visit.items.map(row=><li key={row.client_event_id}>{stamp(row.occurred_at)} · {describe(row)} · 游戏时钟 {row.event_data?.gameTimeMs==null?'未知':`${seconds(row.event_data.gameTimeMs)}秒`} · 构建 {row.event_data?.buildSha?.slice(0,8)??'未知'} · {row.event_data?.internalTest===true?'内部测试':row.event_data?.internalTest===false?'非内部测试':'测试标记未知'}
          {row.event_name==='foreground_no_operation' && <span> · 无操作 {seconds(row.event_data.durationMs)}秒 {row.event_data.possibleAfk?'（可能挂机，不证明离开）':''}{row.event_data.partial?'（下界片段）':''}</span>}
          {row.event_data?.currentNoOperation && <p>截至最后上报，当前无操作至少 {seconds(row.event_data.currentNoOperation.durationMs)}秒{row.event_data.currentNoOperation.possibleAfk?'（可能挂机）':''}；之后未确认。</p>}
          {row.event_data?.activeInteractions?.map(active=><p key={active.interactionId}>进行中互动 {active.objectId}：最后显示 {dialogueEvidence({event_data:active}).shown}；最后确认 {dialogueEvidence({event_data:active}).confirmed}</p>)}
          {(row.event_data?.lastShown||row.event_data?.lastConfirmed)&&<p>最后显示：{dialogueEvidence(row).shown} {resolveStoryHistoryText(row.event_data.lastShown,row.event_data.buildSha,import.meta.env.VITE_BUILD_SHA)??'（对应构建原文未解析）'}；最后确认：{dialogueEvidence(row).confirmed} {resolveStoryHistoryText(row.event_data.lastConfirmed,row.event_data.buildSha,import.meta.env.VITE_BUILD_SHA)??'（对应构建原文未解析）'}</p>}
        </li>)}</ol>
      </details>)}
    </section>}
    <div className="admin-analytics__table-wrap"><table><thead><tr><th>发生时间</th><th>匿名玩家／会话</th><th>实际位置</th><th>发生了什么／内容标识</th><th>前台互动秒</th></tr></thead><tbody>{history.items.map(row=><tr key={row.client_event_id}>
      <td>{stamp(row.occurred_at)}</td><td>{row.visitor_id.slice(0,8)} / {row.session_id.slice(0,8)}</td>
      <td>{row.scene_id} / {row.event_data?.roomId}</td><td>{describe(row)}{row.event_data?.contentId && <small> · {row.event_data.contentId}</small>}</td>
      <td>{row.event_name==='center_object_interacted' ? row.dwell_ms===null ? '—' : `${seconds(row.dwell_ms)}${row.event_data?.partial ? '（中断片段）' : ''}` : '—'}</td>
    </tr>)}</tbody></table></div>
  </section>
}
