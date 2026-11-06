import { useEffect, useMemo, useRef, useState } from 'react'
import { listMainlineAnalyticsInteractionPoints } from '../center/runtime/mainlineAnalyticsInteractionCatalog'
import { loadPlayerHistory, loadReleaseAnalytics } from './centerAnalyticsService'
const names = new Map(listMainlineAnalyticsInteractionPoints().map(point=>[point.objectId,point.label]))
const results = {completed:'完成',cancelled:'取消',interrupted:'中断',blocked:'未能互动','story-completed':'剧情完成','order-submitted':'已下单','order-collected':'已领取','item-consumed':'已消费'}
const seconds = value => (Number(value ?? 0)/1000).toFixed(1)
const stamp = value => new Date(value).toISOString().replace('T',' ').slice(0,19)+' UTC'
function describe(row) {
  if(row.event_name==='center_object_interacted')return `${names.get(row.object_id) ?? row.object_id} · ${results[row.outcome] ?? row.outcome}`
  if(row.event_name==='center_position_sample')return `移动到 (${Number(row.position_x).toFixed(2)}, ${Number(row.position_y).toFixed(2)})`
  if(row.event_name==='session_checkpoint')return `场景前台累计 ${seconds(row.event_data.sceneForegroundMs)} 秒；无移动或输入的可能闲置 ${seconds(Math.max(0,(row.event_data.sceneForegroundMs ?? 0)-(row.event_data.sceneEngagedMs ?? 0)))} 秒`
  return {landing_entry:'打开首页',center_entry_completed:'进入游戏',center_scene_entered:'进入实际位置',center_scene_exited:'离开实际位置',session_end:'页面离开／中断'}[row.event_name] ?? row.event_name
}
export default function ReleaseAnalyticsDashboard() {
  const [environment,setEnvironment]=useState('production'),[days,setDays]=useState(7),[refresh,setRefresh]=useState(0)
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
    loadPlayerHistory({...range,visitorId:visitor}).then(data=>{
      if(epoch.current!==current)return
      setHistory({...data,loading:false})
      setVisitors(old=>[...new Set([...old,...data.items.map(row=>row.visitor_id)])])
    }).catch(error=>{if(epoch.current===current)setHistory({items:[],loading:false,error:error.message})})
    return()=>{if(epoch.current===current)epoch.current++}
  },[range,visitor])
  const earlier=async()=>{
    if(history.loading || !history.nextCursor)return
    const current=epoch.current;setHistory(old=>({...old,loading:true}))
    try{
      const data=await loadPlayerHistory({...range,visitorId:visitor,cursor:history.nextCursor})
      if(epoch.current!==current)return
      setHistory(old=>({...data,items:[...data.items,...old.items],loading:false}))
      setVisitors(old=>[...new Set([...old,...data.items.map(row=>row.visitor_id)])])
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
    {data && <>
      <p>游玩前台 {seconds(data.summary.foreground_ms)} 秒 · 有活动迹象 {seconds(data.summary.engaged_ms)} 秒 · 可能闲置 {seconds(Math.max(0,data.summary.foreground_ms-data.summary.engaged_ms))} 秒</p>
      <p>可能闲置仅指连续30秒没有移动或输入，不证明玩家离开；阅读也可能没有输入。后台不计，游戏加速时间不用于这里。检查点可能带来约15秒边界误差，强制关闭可能缺尾段。</p>
      <h3>所有玩家合并趋势（由原始检查点计算，UTC）</h3>
      <table><thead><tr><th>日期</th><th>匿名玩家</th><th>前台秒</th><th>可能闲置秒</th></tr></thead><tbody>{(data.daily ?? []).map(day=><tr key={day.day}><td>{day.day.slice(0,10)}</td><td>{day.players}</td><td>{seconds(day.foreground_ms)}</td><td>{seconds(Math.max(0,day.foreground_ms-day.engaged_ms))}</td></tr>)}</tbody></table>
      <details><summary>场景／房间停留（由同一历史计算）</summary><table><thead><tr><th>实际位置</th><th>前台秒</th><th>可能闲置秒</th></tr></thead><tbody>{(data.locations ?? []).map(row=><tr key={`${row.scene_id}:${row.room_id}`}><td>{row.scene_id} / {row.room_id}</td><td>{seconds(row.foreground_ms)}</td><td>{seconds(Math.max(0,row.foreground_ms-row.engaged_ms))}</td></tr>)}</tbody></table></details>
    </>}
    <h3>按发生时间排列的历史与移动轨迹</h3>
    <label>玩家 <select value={visitor} onChange={e=>setVisitor(e.target.value)}><option value="">所有匿名玩家合并</option>{visitors.map(id=><option key={id} value={id}>{id}</option>)}</select></label>
    <p>每页500条，按时间从早到晚；可继续加载更早记录。坐标是已有低频抽样，不是每一步。互动包含整段对白与选项，瞬时或未知时长留空。</p>
    {history.error && <p role="alert">{history.error}</p>}{history.loading && <p role="status">正在读取时间线…</p>}
    {history.nextCursor && <button type="button" disabled={history.loading} onClick={earlier}>加载更早历史</button>}
    <div className="admin-analytics__table-wrap"><table><thead><tr><th>发生时间</th><th>匿名玩家／会话</th><th>实际位置</th><th>发生了什么／内容标识</th><th>前台互动秒</th></tr></thead><tbody>{history.items.map(row=><tr key={row.client_event_id}>
      <td>{stamp(row.occurred_at)}</td><td>{row.visitor_id.slice(0,8)} / {row.session_id.slice(0,8)}</td>
      <td>{row.scene_id} / {row.event_data?.roomId}</td><td>{describe(row)}{row.event_data?.contentId && <small> · {row.event_data.contentId}</small>}</td>
      <td>{row.event_name==='center_object_interacted' ? row.dwell_ms===null ? '—' : `${seconds(row.dwell_ms)}${row.event_data?.partial ? '（中断片段）' : ''}` : '—'}</td>
    </tr>)}</tbody></table></div>
  </section>
}
