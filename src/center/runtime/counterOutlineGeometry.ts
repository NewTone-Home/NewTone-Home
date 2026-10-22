import type { CollisionBox, Point } from './sceneGeometry'
const round=(n:number)=>Number(n.toFixed(6))
const key=(p:Point)=>`${p.x}:${p.y}`
/** Exact exterior of axis-aligned counter solids. Shared edges never become strokes. */
export function counterOutlineGeometry(rectangles:readonly CollisionBox[]) {
 if(!rectangles.length)throw new Error('Counter needs a solid')
 const boxes=rectangles.map(b=>({x:round(b.x),y:round(b.y),right:round(b.x+b.width),bottom:round(b.y+b.height)}))
 const xs=[...new Set(boxes.flatMap(b=>[b.x,b.right]))].sort((a,b)=>a-b),ys=[...new Set(boxes.flatMap(b=>[b.y,b.bottom]))].sort((a,b)=>a-b)
 const occupied=(i:number,j:number)=>i>=0&&j>=0&&i<xs.length-1&&j<ys.length-1&&boxes.some(b=>(xs[i]+xs[i+1])/2>b.x&&(xs[i]+xs[i+1])/2<b.right&&(ys[j]+ys[j+1])/2>b.y&&(ys[j]+ys[j+1])/2<b.bottom)
 const edges:{a:Point;b:Point}[]=[]
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++)if(occupied(i,j)){
  const l=xs[i],r=xs[i+1],t=ys[j],b=ys[j+1]
  if(!occupied(i,j-1))edges.push({a:{x:l,y:t},b:{x:r,y:t}})
  if(!occupied(i+1,j))edges.push({a:{x:r,y:t},b:{x:r,y:b}})
  if(!occupied(i,j+1))edges.push({a:{x:r,y:b},b:{x:l,y:b}})
  if(!occupied(i-1,j))edges.push({a:{x:l,y:b},b:{x:l,y:t}})
 }
 const remaining=new Set(edges),loops:Point[][]=[]
 while(remaining.size){const first=remaining.values().next().value!,points=[first.a];let edge=first
  do{remaining.delete(edge);points.push(edge.b);if(key(edge.b)===key(points[0]))break;const next=edges.find(e=>remaining.has(e)&&key(e.a)===key(edge.b));if(!next)throw new Error('Open counter contour');edge=next}while(remaining.size)
  points.pop()
  let changed=true
  while(changed&&points.length>3){changed=false;for(let i=0;i<points.length;i++){const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];if((a.x===b.x&&b.x===c.x)||(a.y===b.y&&b.y===c.y)){points.splice(i,1);changed=true;break}}}
  loops.push(points)
 }
 const bounds={x:xs[0],y:ys[0],width:xs.at(-1)!-xs[0],height:ys.at(-1)!-ys[0]}
 const path=loops.map(loop=>loop.map((p,i)=>`${i?'L':'M'}${round(p.x-bounds.x)} ${round(p.y-bounds.y)}`).join(' ')+' Z').join(' ')
 return{bounds,loops,path}
}
