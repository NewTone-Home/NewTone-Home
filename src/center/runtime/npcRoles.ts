export type NpcDutyDefinition = {
  id: string
  kind: 'ambient' | 'service'
}

export type NpcRoleDefinition = {
  id: 'lao-zhou' | 'cafe-coffee-owner' | 'cafe-floor-server' | 'pedestrian'
  label: string
  duties: Readonly<Record<string, NpcDutyDefinition>>
}

export const npcRoles = {
  laoZhou: {
    id: 'lao-zhou',
    label: '老周',
    duties: {
      seated: { id: 'lao-zhou.seated', kind: 'ambient' },
      observeWindow: { id: 'lao-zhou.observe-window', kind: 'ambient' },
      returnToSeat: { id: 'lao-zhou.return-to-seat', kind: 'ambient' },
      exitCafe: { id: 'lao-zhou.exit-cafe', kind: 'service' },
    },
  },
  cafeCoffeeOwner: {
    id: 'cafe-coffee-owner',
    label: '店员',
    duties: {
      counterService: { id: 'cafe-coffee-owner.counter-service', kind: 'ambient' },
      prepare: { id: 'cafe-coffee-owner.prepare', kind: 'service' },
      deliverCoffee: { id: 'cafe-coffee-owner.deliver-coffee', kind: 'service' },
      returnToCounter: { id: 'cafe-coffee-owner.return-to-counter', kind: 'service' },
    },
  },
  cafeFloorServer: {
    id: 'cafe-floor-server',
    label: '店员',
    duties: {
      tableService: { id: 'cafe-floor-server.table-service', kind: 'ambient' },
    },
  },
  pedestrian: {
    id: 'pedestrian',
    label: '人',
    duties: {},
  },
} as const satisfies Record<string, NpcRoleDefinition>
