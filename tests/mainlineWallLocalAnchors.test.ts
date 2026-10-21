import {describe,expect,it} from 'vitest'
import {fixedMainlineWallGlyphGrid} from '../src/center/runtime/mainlineWallGlyphGrid'
import type {MainlineSceneGeometryUnit,MainlineSceneVisualCell} from '../src/center/runtime/mainlineScenes'

const px=(n:number)=>n/19.2
const cell=(x:number,kind:MainlineSceneVisualCell['kind']='wall'):MainlineSceneVisualCell=>({id:`${kind}-${x}`,x:px(x),y:0,kind,glyph:kind==='door'?'门':'墙'})
const unit=(id:string,start:number,end:number,cells:MainlineSceneVisualCell[]):MainlineSceneGeometryUnit=>({id,ownerId:'frame',edge:'top',geometryKind:'boundary',surface:'wall',x:px(start),y:-.7,width:px(end-start),height:1.4,visual:{kind:'wall',cells},navigation:{blocked:true}})
const centers=(units:MainlineSceneGeometryUnit[])=>units.flatMap(u=>u.visual.cells.filter(c=>c.kind==='wall').map(c=>Math.round(c.x*19.2*1e6)/1e6)).sort((a,b)=>a-b)
describe('local door anchors and approved short wall tail',()=>{
 it('keeps an endpoint glyph whose original collision unit ended at its center',()=>{
  const source=[unit('left',0,80,[cell(0),cell(27),cell(54),cell(80)]),unit('door',80,120,[cell(100,'door')]),unit('right',120,200,[cell(120),cell(147),cell(174),cell(200)])]
  const result=fixedMainlineWallGlyphGrid(source,new Set(['frame:top']))
  expect(centers(result)).toEqual([0,16,44,72,128,156,184,200])
  expect(result.flatMap(u=>u.visual.cells.filter(c=>c.kind==='door'))).toEqual([cell(100,'door')])
  expect(result.map(({visual,...rest})=>rest)).toEqual(source.map(({visual,...rest})=>rest))
 })
 it('keeps exact 28 door neighbors at both ends, puts only one remainder at the wall tail',()=>{
  const source=[unit('all',0,160,[cell(0,'door'),cell(27),cell(54),cell(80),cell(107),cell(134),cell(160,'door')])]
  expect(centers(fixedMainlineWallGlyphGrid(source,new Set(['frame:top'])))).toEqual([28,56,84,112,132])
 })
 it('does not put almost coincident endpoint glyphs in a rounded 28-pitch run',()=>{
  const source=[unit('rounded',0,84.005,[cell(0),cell(28),cell(56),cell(84.005)])]
  expect(centers(fixedMainlineWallGlyphGrid(source,new Set(['frame:top'])))).toEqual([0,28,56,84.005])
 })
 it('leaves explicitly fixed-count edges of the same owner untouched',()=>{
  const source=[unit('same-owner-fixed-edge',0,80,[cell(0),cell(40),cell(80)])]
  expect(fixedMainlineWallGlyphGrid(source,new Set(['frame:left']))).toEqual(source)
 })
 it('shares only an extreme 0.96px end remainder over the final two intervals',()=>{
  const source=[unit('office-tail',115.2,284.16,Array.from({length:7},(_,i)=>cell(115.2+i*28)).concat(cell(284.16)))]
  expect(centers(fixedMainlineWallGlyphGrid(source,new Set(['frame:top'])))).toEqual([115.2,143.2,171.2,199.2,227.2,255.2,269.68,284.16])
 })
 it('shares the leading tail when growing away from a fixed far door',()=>{
  const source=[unit('far-door',0,130,[cell(0),cell(25),cell(50),cell(75),cell(102),cell(130,'door')])]
  // Door neighbor102 remains fixed; the near tail18 is already wide enough.
  expect(centers(fixedMainlineWallGlyphGrid(source,new Set(['frame:top'])))).toEqual([0,18,46,74,102])
  const tiny=[unit('far-door',0,116,[cell(0),cell(22),cell(44),cell(66),cell(88),cell(116,'door')])]
  expect(centers(fixedMainlineWallGlyphGrid(tiny,new Set(['frame:top'])))).toEqual([0,16,32,60,88])
 })
})
