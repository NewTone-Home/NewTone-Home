# 商业街旧表手机回程修复候选8220392；字号16收口待确认

最新状态：父端独立QA通过后，手机单项8220392已于2026-10-21 04:08:53 UTC发布原4173与同一QuickTunnel；公开仍14号字。全部8文件本地/公网16次HTTP读回均200且bytes/SHA匹配冻结4182。公开桌面/手机新档入口、行走和刷新通过；隔离v1旧档迁移、刷新及剧情/真实奶茶/联系人保留通过。556a45b完整保留回滚，真实存档未动，无push。发布证据在.tmp/publish-8220392/。Notion同页已补发布记录并更新标题。

字体末三段例外随后已获作者明确批准，在0d1106f/4183独立候选实施，未发布。以下待批准描述是此前诊断历史。

Notion Codex板原生子页正文：https://app.notion.com/p/400b138d1e1181a7a2e4f8a263f89c9b 。回读已核对应用SHA、实际diff、完整UI回程、真实物品字段、基线失败与字号待确认状态。

## 根因与最小策略

公开556a45b的PlayerSave版本一直是1。sanitizePlayerSave把已知scene、合法手机枚举和有效位置视为validCore，原样保留商业街+surface；但phoneState.phoneConnectionFor规定设备和物理世界必须相同，商业街属于inner，surface必定offline。商业街也没有换机终端。因此上一轮只修新档/损坏核心，没有修复这一合法字段组成的旧死锁组合。

应用提交 `8220392e571b71eb58c19773dffead931b67a778`，只改playerSave.ts与新增兼容测试；当前公开仍为556a45b，未替换。字号16尚未落地，不能把4182称为16字候选。

修法：保留storage key newtone-player-save-v1，将payload _version升为2。仅版本低于2/未标版本的有效商业街+surface组合，把phoneDevice改为inner。currentSceneId、currentPosition、scenePositions、sceneState（剧情与奶茶等物品）、storyClock、通知/笔记/联系人/通话数据等继续按既有clean函数原样保留，不清档、不迁移角色坐标、不重置剧情。版本2的主动手机选择不再反复自动改回；其他场景的合法表手机保持。pre-unified legacy位置/手机格式也通过同一迁移处理。

这是对已发布旧版本的有限兼容，不是改变表/里世界信号规则，也不把所有离线设备强行上线。若将来v2进度通过主动操作带错设备，这条旧档迁移不会每次强改；本轮没有新增全场景自动换机。

## 实际函数差异

- playerSave.ts / PLAYER_SAVE_VERSION：1→2，storage key保持。
- readLegacyPlayerSave：识别旧位置后通过sanitizePlayerSave并携带旧版本标记，避免漏掉旧格式中有商业街位置的surface组合。
- sanitizePlayerSave：新增repairLegacyStreetPhone条件，其他核心与进度清理规则不改。
- legacyStreetPhoneRecovery.test.ts：旧版本/无版本完整保留、修复落盘与后续主动选择、其他scene不改、pre-unified格式、真实commercialStreetMilkTeaHeldDrink='milk-tea'字段保留。

## 真实回程链路验证

代码没有姬家大院直达出租车路线。inner叫车目的地为商业街、中枢院、矿区；handleRideRequest还检查longDistanceTravelContract，不能只在地图加一个按钮冒称可直达。

本轮验证的是现有正常路线：**商业街手机叫车→中枢院办公室→办公室暗道门→暗道左门→祖宅内堂→正门→大院**。未新增跨世界路线、未改剧情或传送目标。

Chrome155.0.8059.85、1280×800，在独立context只在开始注入一份模拟v1旧档：商业街(34,50)、surface、Cafe complete、真实奶茶持有状态与独立进度标记。其后只正常点击手机、叫车、等待真实司机通知、走到街口上车、点击/步行通过合法门；没有改途中的坐标或scene URL。

实测依次到达：commercial-street inner (34,50)→真实ride order→zhongshuyuan-office (16,82)→zhongshuyuan-passage (95.8935,50)→jijia-ancestral-interior (96,64)→jijia-ancestral-home (96,50)。Cafe complete、奶茶持有字段commercialStreetMilkTeaHeldDrink和背包标记均保留。真实用户浏览器存档未读写。

到大院后仍持inner手机，因此按既有世界规则会离线；本轮没有擅自自动换表手机。这不影响从大院步行经内堂/暗道返回办公室，办公室原换机动作保留。没有把叫车到办公室说成出租车直接到大院。

证据 `.tmp/qa-legacy-street-home/result.json`、6阶段截图、脚本qa-legacy-street-home.mjs；23项save/initial兼容测试通过，typecheck与隔离Vite build通过（既有大chunk提示）。手机尺寸完整回程未在本轮重复跑，交独立QA。

补跑4套ride回归为13通过/1失败：旧独立Cafe坐姿出发ETA返回null，断言要求数字。已用git archive完整隔离fbc16e9的src和同4测试复现完全相同13/1，失败名称与错误一致；证据legacy-phone-ride-regressions.json与legacy-phone-ride-baseline.json。没有改断言或扩项修旧独立Cafe路径；本轮实际商业街站立旧档的全程UI回家通过，不据此宣称所有姿态/旧Cafe回程都通过。

## 固定手机单项候选4182（仍14号字）

- 地址 http://127.0.0.1:4182/ ，PID16716，outDir .tmp/legacy-street-phone-dist。
- 应用SHA 8220392e571b71eb58c19773dffead931b67a778。
- JS index-CIcd_RoS.js，828932 bytes，SHA256 207862B9DA1D0D60EC9EFCB66B51B068B3AA8FAA04CB4F58876266EDA74B05C8。
- CSS index-DqwytlUi.css，200263 bytes，SHA256 8037B3161155B4BD755F467A08FC895B2A38EBAA6A21E30C7F8CC89513EB913A。
- 未push、未更新公网、未改main/staging/Vercel；等父端确认独立QA后才切换原临时链接，同轮不用再次问发布授权。

## 字号16的明确阻塞（未扩权）

普通字16已获批准；墙28、家具字距16、问号38特例与世界外UI不变。但当前12处两段短尾中8处的字中心距小于16：办公室6组、兼容旧独立Cafe2组，最小14.48。父端QA的font16-risk-prediction.json也测得16字形ink指标16，预测最小重叠1.52。

例如原极短尾0.96，末两段总长度28.96，固定两端时无论怎么分，两段都不可能≥16。不能靠重新均分两段解决。最小额外选择是只对这8处借用再前一段28，改为尾部三段均分：56.96/3=18.9867，其余直墙仍28、所有端点/门位/碰撞不动。8组均有足够字符可做该局部三段调整，数据在.tmp/font16-tail-constraints.json。

**末三段超出当前末两段授权，尚未实施；没有改字号为16后把已知重叠偷偷留给QA，也没有动边界。等待父端/作者确认这一必要选择。** 当前任务只有手机单项完成候选，不能宣称两项全部完成或全局场景已验收。

## 实际代码diff

以下依次为应用playerSave差异、真实奶茶物品字段测试补强、原新增兼容测试。测试补强不影响已固定4182应用bundle。

```diff
diff --git a/src/center/runtime/playerSave.ts b/src/center/runtime/playerSave.ts
index 1b90976..725d5e8 100644
--- a/src/center/runtime/playerSave.ts
+++ b/src/center/runtime/playerSave.ts
@@ -8,7 +8,7 @@ import { applyPublicReleaseCutover } from '../../services/publicReleaseMigration
 import { cleanPhoneCallHistory, cleanPhoneContactNotes, cleanPhoneNotes, createInitialPhoneNotes, type PhoneCallRecord, type PhoneNote } from './phonePersonalData'

 export const PLAYER_SAVE_STORAGE_KEY = 'newtone-player-save-v1'
-export const PLAYER_SAVE_VERSION = 1
+export const PLAYER_SAVE_VERSION = 2
 const LEGACY_PHONE_STORAGE_KEYS = ['newtone.mainline.carried-phone.v2', 'newtone.mainline.carried-phone.v1']
 const LEGACY_POSITION_STORAGE_KEY = 'newtone.mainline.scene-positions.v2'

@@ -140,7 +140,9 @@ function readLegacyPlayerSave(storage: PlayerSaveStorage | null, fallbackSceneId
     migrated.currentSceneId = initialMainlineSceneId
     migrated.phoneDevice = initialMainlinePhoneDevice
   }
-  return hasLegacyValue ? migrated : createInitialPlayerSave(fallbackSceneId)
+  return hasLegacyValue
+    ? sanitizePlayerSave({ ...migrated, _version: 1 }, fallbackSceneId)
+    : createInitialPlayerSave(fallbackSceneId)
 }

 export function sanitizePlayerSave(value: unknown, _fallbackSceneId: MainlineSceneId): PlayerSave {
@@ -151,7 +153,14 @@ export function sanitizePlayerSave(value: unknown, _fallbackSceneId: MainlineSce
   const currentSceneId = validCore
     ? source.currentSceneId as MainlineSceneId
     : initialMainlineSceneId
-  const phoneDevice = validCore ? source.phoneDevice as PhoneDevice : initialMainlinePhoneDevice
+  const savedVersion = Number(source._version ?? 0)
+  // Version1 treated a valid street + surface-phone pair as resumable, even
+  // though that phone is offline here and the street has no swap terminal.
+  // Repair only that old combination; keep position/progression and respect
+  // deliberate phone choices made after this migration has been saved.
+  const repairLegacyStreetPhone = validCore && currentSceneId === 'commercial-street'
+    && source.phoneDevice === 'surface' && (!Number.isFinite(savedVersion) || savedVersion < 2)
+  const phoneDevice = repairLegacyStreetPhone ? 'inner' : validCore ? source.phoneDevice as PhoneDevice : initialMainlinePhoneDevice
   const scenePositions = cleanScenePositions(source.scenePositions)
   if (!validCore) delete scenePositions[initialMainlineSceneId]
   const storyStage = source.storyClock?.stage
warning: in the working copy of 'tests/legacyStreetPhoneRecovery.test.ts', LF will be replaced by CRLF the next time Git touches it
diff --git a/tests/legacyStreetPhoneRecovery.test.ts b/tests/legacyStreetPhoneRecovery.test.ts
index 204a8d4..0247c96 100644
--- a/tests/legacyStreetPhoneRecovery.test.ts
+++ b/tests/legacyStreetPhoneRecovery.test.ts
@@ -1,10 +1,12 @@
 import {describe,it,expect} from 'vitest'
 import {createInitialPlayerSave,loadPlayerSave,sanitizePlayerSave,savePlayerSave,PLAYER_SAVE_STORAGE_KEY,PLAYER_SAVE_VERSION} from '../src/center/runtime/playerSave'
+import {commercialStreetMilkTeaHeld} from '../src/center/runtime/commercialStreetMilkTea'
 const storage=()=>{const data=new Map([['newtone-public-release-cutover-v1','center-v1']]);return{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)},removeItem:(key:string)=>{data.delete(key)}}}
 describe('one-time legacy street phone compatibility without restarting progress',()=>{
  it.each([undefined,1])('repairs old version %s while retaining every other save field',version=>{
-  const source={...createInitialPlayerSave(),_version:version,currentSceneId:'commercial-street',phoneDevice:'surface',currentPosition:{x:135,y:-20},scenePositions:{'commercial-street':{x:135,y:-20},'jijia-ancestral-home':{x:25,y:50},'commercial-cafe':{x:58,y:68}},sceneState:{'commercial-street':{milkTeaHeld:true,orderStatus:'ready'},'commercial-cafe':{commercialCafeStoryStatus:'complete',narrativeCursor:7}},phoneContactNotes:{'lao-zhou':'kept'},updatedAt:1234}
+  const source={...createInitialPlayerSave(),_version:version,currentSceneId:'commercial-street',phoneDevice:'surface',currentPosition:{x:135,y:-20},scenePositions:{'commercial-street':{x:135,y:-20},'jijia-ancestral-home':{x:25,y:50},'commercial-cafe':{x:58,y:68}},sceneState:{'commercial-street':{commercialStreetMilkTeaHeldDrink:'milk-tea',commercialStreetMilkTeaAppUnlocked:true,orderStatus:'ready'},'commercial-cafe':{commercialCafeStoryStatus:'complete',narrativeCursor:7}},phoneContactNotes:{'lao-zhou':'kept'},updatedAt:1234}
   expect(sanitizePlayerSave(source,'commercial-cafe')).toEqual({...source,_version:PLAYER_SAVE_VERSION,phoneDevice:'inner'})
+  expect(commercialStreetMilkTeaHeld(sanitizePlayerSave(source,'commercial-cafe').sceneState['commercial-street'])).toBe(true)
  })
  it('persists the repair and does not rewrite subsequent intentional surface-phone choices',()=>{
   const store=storage();store.setItem(PLAYER_SAVE_STORAGE_KEY,JSON.stringify({...createInitialPlayerSave(),_version:1,phoneDevice:'surface',currentPosition:{x:34,y:50}}))
diff --git a/tests/legacyStreetPhoneRecovery.test.ts b/tests/legacyStreetPhoneRecovery.test.ts
new file mode 100644
index 0000000..204a8d4
--- /dev/null
+++ b/tests/legacyStreetPhoneRecovery.test.ts
@@ -0,0 +1,23 @@
+import {describe,it,expect} from 'vitest'
+import {createInitialPlayerSave,loadPlayerSave,sanitizePlayerSave,savePlayerSave,PLAYER_SAVE_STORAGE_KEY,PLAYER_SAVE_VERSION} from '../src/center/runtime/playerSave'
+const storage=()=>{const data=new Map([['newtone-public-release-cutover-v1','center-v1']]);return{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)},removeItem:(key:string)=>{data.delete(key)}}}
+describe('one-time legacy street phone compatibility without restarting progress',()=>{
+ it.each([undefined,1])('repairs old version %s while retaining every other save field',version=>{
+  const source={...createInitialPlayerSave(),_version:version,currentSceneId:'commercial-street',phoneDevice:'surface',currentPosition:{x:135,y:-20},scenePositions:{'commercial-street':{x:135,y:-20},'jijia-ancestral-home':{x:25,y:50},'commercial-cafe':{x:58,y:68}},sceneState:{'commercial-street':{milkTeaHeld:true,orderStatus:'ready'},'commercial-cafe':{commercialCafeStoryStatus:'complete',narrativeCursor:7}},phoneContactNotes:{'lao-zhou':'kept'},updatedAt:1234}
+  expect(sanitizePlayerSave(source,'commercial-cafe')).toEqual({...source,_version:PLAYER_SAVE_VERSION,phoneDevice:'inner'})
+ })
+ it('persists the repair and does not rewrite subsequent intentional surface-phone choices',()=>{
+  const store=storage();store.setItem(PLAYER_SAVE_STORAGE_KEY,JSON.stringify({...createInitialPlayerSave(),_version:1,phoneDevice:'surface',currentPosition:{x:34,y:50}}))
+  const repaired=loadPlayerSave(store);expect(repaired.phoneDevice).toBe('inner');savePlayerSave(repaired,store,100)
+  expect(loadPlayerSave(store).phoneDevice).toBe('inner')
+  savePlayerSave({...repaired,phoneDevice:'surface'},store,200)
+  expect(loadPlayerSave(store)).toMatchObject({_version:2,phoneDevice:'surface',currentPosition:{x:34,y:50}})
+ })
+ it('preserves valid surface-world and office journeys regardless of their old phone',()=>{
+  for(const currentSceneId of ['jijia-ancestral-home','zhongshuyuan-office']as const){const source={...createInitialPlayerSave(),_version:1,currentSceneId,phoneDevice:'surface',currentPosition:{x:25,y:50}};expect(sanitizePlayerSave(source,'commercial-street')).toEqual({...source,_version:2})}
+ })
+ it('also repairs the identifiable pre-unified street position format',()=>{
+  const store=storage();store.setItem('newtone.mainline.carried-phone.v2',JSON.stringify('surface'));store.setItem('newtone.mainline.scene-positions.v2',JSON.stringify({'commercial-street':{x:135,y:-20},'jijia-ancestral-home':{x:25,y:50}}))
+  expect(loadPlayerSave(store)).toMatchObject({_version:2,currentSceneId:'commercial-street',currentPosition:{x:135,y:-20},phoneDevice:'inner',scenePositions:{'jijia-ancestral-home':{x:25,y:50}}})
+ })
+})
```
