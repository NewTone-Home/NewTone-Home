import { describe, expect, test, vi } from 'vitest';
import { webcrypto, createHash } from 'node:crypto';
import { createPlayerCloudService, createPlayerCloudPayloadFromAuthority, fingerprintPlayerCloudPayload, serializePlayerCloudPayload } from '../src/services/playerCloudService.mjs';
const ownerId='11111111-1111-4111-8111-111111111111', sessionId='22222222-2222-4222-8222-222222222222';
const operationId='33333333-3333-4333-8333-333333333333';
function rig() {
 let scope={ownerId,sessionId}, time=0;
 const rpc=vi.fn(async (_name, {p_action}) => ({data: p_action==='activate'||p_action==='renew'||p_action==='resume' ? {ok:true,fence:'1',serverNow:'2026-11-07T00:00:00Z',leaseUntil:'2026-11-07T00:01:30Z'} : {ok:true,ownerId,operationId,revision:'1'}}));
 const persistPending=vi.fn(async()=>{}), clearPending=vi.fn(async()=>{});
 const service=createPlayerCloudService({rpc,getScope:()=>scope,persistPending,clearPending,now:()=>time});
 return {service,rpc,persistPending,clearPending,setScope:s=>{scope=s;},setTime:t=>{time=t;}};
}
describe('isolated player cloud client',()=>{
 test('does not activate through reads or token refresh',async()=>{
  const r=rig(); expect(()=>r.service.listSlots()).toThrow('CLOUD_SESSION_NOT_ACTIVE'); expect(r.rpc).not.toHaveBeenCalled();
  await r.service.activateAfterExplicitLogin(); await r.service.renew();
  expect(r.rpc.mock.calls.map(x=>x[1].p_action)).toEqual(['activate','renew']);
 });
 test('persists immutable request before network, acknowledges only success',async()=>{
  const r=rig(); await r.service.activateAfterExplicitLogin();
  const parameters={operationId,slotId:operationId,slotNo:1,payloadRaw:'{}',sourceFingerprint:'x'};
  const req=r.service.prepare('create',parameters); parameters.slotNo=3;
  expect(Object.isFrozen(req.parameters)).toBe(true); await r.service.execute(req);
  expect(r.rpc.mock.calls.at(-1)[1].p_args.slotNo).toBe(1);
  expect(r.persistPending.mock.invocationCallOrder[0]).toBeLessThan(r.rpc.mock.invocationCallOrder[1]);
  expect(r.clearPending).toHaveBeenCalledTimes(1);
 });
 test('uncertain request retained; retry keeps exact operation',async()=>{
  const r=rig();await r.service.activateAfterExplicitLogin();const req=r.service.prepare('write',{operationId,expectedRevision:'1'});
  r.rpc.mockRejectedValueOnce(Error('connection dropped'));
  expect((await r.service.execute(req)).code).toBe('OUTCOME_UNCERTAIN');expect(r.clearPending).not.toHaveBeenCalled();
  await r.service.execute(req);expect(r.rpc.mock.calls.at(-1)[1].p_args.operationId).toBe(operationId);
 });
 test('CAS conflict never retries or clears pending',async()=>{
  const r=rig();await r.service.activateAfterExplicitLogin();r.rpc.mockResolvedValueOnce({data:{ok:false,code:'REVISION_CONFLICT',revision:'2'}});
  const result=await r.service.execute(r.service.prepare('write',{operationId,expectedRevision:'1'}));
  expect(result.code).toBe('REVISION_CONFLICT');expect(r.rpc).toHaveBeenCalledTimes(2);expect(r.clearPending).not.toHaveBeenCalled();
 });
 test('old identity response cannot acknowledge a new account',async()=>{
  const r=rig();await r.service.activateAfterExplicitLogin();let finish;
  r.rpc.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const pending=r.service.execute(r.service.prepare('write',{operationId}));await Promise.resolve();await Promise.resolve();
  r.setScope({ownerId:operationId,sessionId});finish({data:{ok:true}});
  await expect(pending).rejects.toThrow('STALE_CLOUD_RESPONSE');expect(r.clearPending).not.toHaveBeenCalled();
 });
 test('replacement stops client, expired lease blocks calls but renew can recover',async()=>{
  const r=rig();await r.service.activateAfterExplicitLogin();r.setTime(86000);expect(r.service.isActive).toBe(false);
  await expect(r.service.listSlots()).rejects.toThrow('CLOUD_SESSION_NOT_ACTIVE');await r.service.renew();expect(r.service.isActive).toBe(true);
  r.rpc.mockResolvedValueOnce({error:{message:'SESSION_REPLACED'}});await r.service.listSlots();expect(r.service.isActive).toBe(false);
 });
 test('rejects arbitrary account/fence and mismatched receipt',async()=>{
  const r=rig();await r.service.activateAfterExplicitLogin();expect(()=>r.service.prepare('write',{operationId,ownerId})).toThrow('SERVER_AUTHORITY_REQUIRED');
  r.rpc.mockResolvedValueOnce({data:{ok:true,ownerId:operationId,operationId}});
  await expect(r.service.execute(r.service.prepare('write',{operationId}))).rejects.toThrow('CLOUD_RECEIPT_OWNER_MISMATCH');expect(r.clearPending).not.toHaveBeenCalled();
 });
 test('canonical fingerprint binds exact UTF8 including Unicode and rejects lossy values',async()=>{
  const payload={z:'中文',a:{b:1,a:true}};const result=await fingerprintPlayerCloudPayload(payload,webcrypto.subtle);
  expect(result.payloadRaw).toBe('{"a":{"a":true,"b":1},"z":"中文"}');
  expect(result.sourceFingerprint).toBe(createHash('sha256').update(result.payloadRaw,'utf8').digest('hex'));
  expect(()=>serializePlayerCloudPayload({bad:undefined})).toThrow('INVALID_PAYLOAD_VALUE');
  expect(()=>serializePlayerCloudPayload({bad:NaN})).toThrow('INVALID_PAYLOAD_NUMBER');
 });
});


test('portable authority export excludes retired sources and preserves active Reader',()=>{
 const authority={saveEpoch:'persistent-era-1',protocolVersion:2,revision:4,generation:{id:'g',sequence:1},values:{'newtone-player-save-v1':'{}','newtone-progress-v4':'{"chapter":2}'},recoveryHolds:[],sources:{old:'retired'},archive:{secret:'old'},operationReceipt:{operationId:'old'}};
 const portable=createPlayerCloudPayloadFromAuthority(authority);
 expect(portable.values['newtone-progress-v4']).toBe('{"chapter":2}');expect(portable.localRevision).toBe(4);
 expect(portable.sources).toBeUndefined();expect(portable.archive).toBeUndefined();expect(portable.operationReceipt).toBeUndefined();
 authority.values['newtone-player-save-v1']='changed';expect(portable.values['newtone-player-save-v1']).toBe('{}');
 expect(()=>createPlayerCloudPayloadFromAuthority({...authority,values:{...authority.values,'newtone-layout-test':'{}'}})).toThrow('INVALID_PLAYER_VALUES');
});
test('adoption requires matching server owner, slot, operation and source fingerprint',async()=>{
 const r=rig();await r.service.activateAfterExplicitLogin();
 const request=r.service.prepare('adopt',{operationId,slotId:sessionId,payloadRaw:'{}',sourceFingerprint:'abc'});
 r.rpc.mockResolvedValueOnce({data:{ok:true,ownerId,operationId,slotId:sessionId,sourceFingerprint:'different'}});
 await expect(r.service.execute(request)).rejects.toThrow('CLOUD_ADOPTION_RECEIPT_MISMATCH');expect(r.clearPending).not.toHaveBeenCalled();
 r.rpc.mockResolvedValueOnce({data:{ok:true,ownerId,operationId,slotId:sessionId,sourceFingerprint:'abc'}});
 expect((await r.service.execute(request)).ok).toBe(true);expect(r.clearPending).toHaveBeenCalledTimes(1);
});

test('restored session resumes without activation or requiring a locally cached fence',async()=>{
 const r=rig();await r.service.resumeExistingSession();expect(r.service.isActive).toBe(true);expect(r.rpc.mock.calls[0][1]).toEqual({p_action:'resume',p_args:{}});
});
