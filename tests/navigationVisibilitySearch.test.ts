import {describe,it,expect} from 'vitest'
import {createPolygonNavigationMesh,navigationBarriersAllowTravel} from '../src/center/runtime/scenePathfinding'
import type {CollisionBox,Point,NavigationBarrierSegment} from '../src/center/runtime/sceneGeometry'
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
function crosses(a:Point,b:Point,box:CollisionBox){let lo=0,hi=1;for(const [s,e,min,max]of [[a.x,b.x,box.x,box.x+box.width],[a.y,b.y,box.y,box.y+box.height]]){const d=e!-s!;if(Math.abs(d)<=.0001){if(s!<=min!+.0001||s!>=max!-.0001)return false;continue}const p=(min!-s!)/d,q=(max!-s!)/d;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));if(lo>=hi-.0001)return false}return lo<1-.0001&&hi>.0001&&lo<hi-.0001}
function fullGraphDistance(start:Point,goal:Point,boxes:CollisionBox[],barriers:NavigationBarrierSegment[]){
 const nodes=[start,goal,...boxes.flatMap(b=>[{x:b.x-.02,y:b.y-.02},{x:b.x+b.width+.02,y:b.y-.02},{x:b.x+b.width+.02,y:b.y+b.height+.02},{x:b.x-.02,y:b.y+b.height+.02}]),...barriers.flatMap(b=>{const dx=b.end.x-b.start.x,dy=b.end.y-b.start.y,len=Math.hypot(dx,dy),tx=dx/len,ty=dy/len;return[b.start,b.end].flatMap((p,i)=>[-1,1].map(side=>({x:p.x+tx*.02*(i?1:-1)-ty*.02*side,y:p.y+ty*.02*(i?1:-1)+tx*.02*side})))})].filter((p,i)=>i<2||p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100&&!boxes.some(b=>p.x>=b.x-.0001&&p.x<=b.x+b.width+.0001&&p.y>=b.y-.0001&&p.y<=b.y+b.height+.0001))
 const links=nodes.map(()=>new Map<number,number>())
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(!boxes.some(b=>crosses(nodes[i]!,nodes[j]!,b))&&navigationBarriersAllowTravel(nodes[i]!,nodes[j]!,barriers)){const d=distance(nodes[i]!,nodes[j]!);links[i]!.set(j,d);links[j]!.set(i,d)}
 const cost=nodes.map(()=>Infinity),done=new Set<number>();cost[0]=0
 for(let i=0;i<nodes.length;i++){let current=-1;for(let j=0;j<nodes.length;j++)if(!done.has(j)&&(current<0||cost[j]!<cost[current]!))current=j;if(current<0||!Number.isFinite(cost[current]))break;done.add(current);for(const[j,d]of links[current]!)cost[j]=Math.min(cost[j]!,cost[current]!+d)}return cost[1]!
}
describe('lazy visibility A* agrees with independent full-graph Dijkstra',()=>{
 it.each([
  {boxes:[{x:30,y:0,width:8,height:65},{x:58,y:35,width:8,height:65}],barriers:[]},
  {boxes:[{x:45,y:0,width:8,height:100}],barriers:[]},
  {boxes:[{x:25,y:25,width:15,height:35}],barriers:[{id:'relation',start:{x:60,y:20},end:{x:60,y:70}}]},
 ])('preserves shortest legal cost for cold and progressively warmed queries: %o',({boxes,barriers})=>{
  const mesh=createPolygonNavigationMesh({bounds:{x:0,y:0,width:100,height:100},obstacles:boxes,barriers,deferTopology:true})
  const start={x:10,y:10};for(let n=0;n<30;n++){const goal={x:75+(n%5)*4,y:5+Math.floor(n/5)*17};const expected=fullGraphDistance(start,goal,boxes,barriers);const path=mesh.findPath(start,goal);if(!Number.isFinite(expected)){expect(path).toBeNull();continue}expect(path).not.toBeNull();const cost=path!.slice(1).reduce((sum,p,i)=>sum+distance(path![i]!,p),0);expect(cost).toBeCloseTo(expected,6);for(let i=1;i<path!.length;i++){expect(boxes.some(b=>crosses(path![i-1]!,path![i]!,b))).toBe(false);expect(navigationBarriersAllowTravel(path![i-1]!,path![i]!,barriers)).toBe(true)}}
 })
})
