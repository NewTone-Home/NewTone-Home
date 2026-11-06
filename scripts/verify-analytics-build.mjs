// No build/deploy/network is executed: evaluate the actual wrapper with explicit synthetic dependencies.
import vm from 'node:vm'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {analyticsBuildEnvironment} from '../src/services/analyticsRelease.js'
const source=readFileSync(new URL('./vercel-build.mjs',import.meta.url),'utf8')
for(const [branch,target,override,expected] of [['main','production',undefined,'production'],['staging','production',undefined,'staging'],['feature/test','preview',undefined,'preview'],['main','production','false','production']]){
 let written,buildEnv,exitCode
 const input={VERCEL_GIT_COMMIT_REF:branch,VERCEL_ENV:target,VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VITE_SUPABASE_URL:'https://production.invalid'}
 if(override!==undefined)input.VITE_PLAYER_HISTORY_V2=override
 const context=vm.createContext({URL,process:{env:input,platform:'linux',exit:code=>{exitCode=code}},console:{log(){},error(){}}})
 const stub=(names,values)=>new vm.SyntheticModule(names,function(){names.forEach((name,index)=>this.setExport(name,values[index]))},{context})
 const dependencies={
 'node:child_process':stub(['spawnSync'],[(_cmd,_args,options)=>{buildEnv=options.env;return {status:0}}]),
 'node:fs':stub(['writeFileSync'],[(_path,body)=>{written=JSON.parse(body)}]),
 '../src/services/analyticsRelease.js':stub(['analyticsBuildEnvironment'],[analyticsBuildEnvironment]),
 }
 const module=new vm.SourceTextModule(source,{context,initializeImportMeta:meta=>{meta.url=new URL('./vercel-build.mjs',import.meta.url).href}})
 await module.link(name=>dependencies[name]);await module.evaluate()
 assert.equal(exitCode,0);assert.equal(written.environment,expected);assert.equal(written.buildSha,'a'.repeat(40))
 assert.equal(written.historyV2Enabled,override==='false'?false:['main','staging'].includes(branch))
 assert.equal(buildEnv.VITE_PLAYER_HISTORY_V2,String(written.historyV2Enabled))
 assert.equal(buildEnv.VITE_SUPABASE_URL,branch==='staging'?'https://ksrvlkcpaiowhcvzimkc.supabase.co':'https://production.invalid')
 assert.deepEqual(Object.keys(written).sort(),['buildSha','environment','historyV2Enabled','release'])
}
console.log(JSON.stringify({status:'passed',cases:4,checks:['public branch enablement','explicit false kill switch','environment isolation','valid public manifest JSON','exact build SHA','no secret manifest fields']}))
