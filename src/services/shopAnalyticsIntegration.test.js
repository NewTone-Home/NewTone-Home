import { describe, it, expect } from 'vitest'
import { placePaidShopOrder } from '../center/runtime/shopOrderPayment'
import { crossShopIds, claimCrossShopOrder, consumeHeldConsumable } from '../center/runtime/crossShopOrders'
import { shopProductsFor } from '../center/runtime/shopOrderCatalog'
import { notifyDueShopOrders } from '../center/runtime/shopOrderCompletion'
import { createPositionSaveCoordinator } from '../center/runtime/playerSave'
import { shopAnalyticsTransitions } from './shopAnalytics'
describe.each(Object.values(crossShopIds))('shared committed facts %s', shopId => {
  it('payment retry, ready, collection and consume produce one fact each; failed persistence none', () => {
    let save={shopOrders:{},shopOrderPaymentReceipts:{},heldConsumable:null,walletBalance:800}, fail=false
    const facts=[]
    const coordinator=createPositionSaveCoordinator({getSave:()=>save,setSave:next=>{save=next},getCurrentSceneId:()=> 'commercial-street',recordPosition:s=>s,persist:next=>{if(fail)throw Error('injected-write-failure');return next}})
    const commit=update=>{const previous=save;const next=coordinator.commit(update);facts.push(...shopAnalyticsTransitions(previous,next))}
    const product=shopProductsFor(shopId)[0]
    const input={shopId,productId:product.id,idempotencyKey:'test-key',orderId:'test-order',price:product.price,placedAtGameTimeMs:0,preparationDurationMs:1000}
    const purchase=current=>{const result=placePaidShopOrder({ordersByShop:current.shopOrders,heldConsumable:current.heldConsumable},{walletBalance:current.walletBalance,paymentReceipts:current.shopOrderPaymentReceipts},input);return result.ok?{...current,shopOrders:result.orderState.ordersByShop,shopOrderPaymentReceipts:result.paymentState.paymentReceipts,walletBalance:result.paymentState.walletBalance}:current}
    fail=true;expect(()=>commit(purchase)).toThrow('injected-write-failure');expect(facts).toEqual([]);expect(save.walletBalance).toBe(800)
    fail=false;commit(purchase);commit(purchase)
    expect(save.walletBalance).toBe(800-product.price)
    commit(current=>({...current,shopOrders:notifyDueShopOrders(current.shopOrders,[],1000).orders}))
    commit(current=>{const result=claimCrossShopOrder({ordersByShop:current.shopOrders,heldConsumable:current.heldConsumable},shopId,1000);expect(result.ok).toBe(true);return {...current,shopOrders:result.state.ordersByShop,heldConsumable:result.state.heldConsumable}})
    commit(current=>{const result=consumeHeldConsumable({ordersByShop:current.shopOrders,heldConsumable:current.heldConsumable});return {...current,shopOrders:result.state.ordersByShop,heldConsumable:result.state.heldConsumable}})
    expect(facts.map(f=>f.outcome)).toEqual(['order-submitted','order-collected','item-consumed'])
    expect(facts.every(f=>f.objectId===shopId)).toBe(true)
  })
})
