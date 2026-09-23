export type NpcDutyDefinition = {
  id: string
  kind: 'ambient' | 'service'
}

export type NpcRoleDefinition = {
  id: 'lao-zhou' | 'server'
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
    },
  },
  server: {
    id: 'server',
    label: '店员',
    duties: {
      counterService: { id: 'server.counter-service', kind: 'ambient' },
      prepare: { id: 'server.prepare', kind: 'service' },
      tableService: { id: 'server.table-service', kind: 'ambient' },
      walkToSupplies: { id: 'server.walk-to-supplies', kind: 'service' },
      fetchSupplies: { id: 'server.fetch-supplies', kind: 'service' },
      deliverCoffee: { id: 'server.deliver-coffee', kind: 'service' },
      returnToCounter: { id: 'server.return-to-counter', kind: 'service' },
    },
  },
} as const satisfies { laoZhou: NpcRoleDefinition; server: NpcRoleDefinition }
