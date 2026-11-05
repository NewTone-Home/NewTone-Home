import { createWorldGrid } from './worldGrid'

export const officeGrid = createWorldGrid({ x: 6, y: 8 })
export const officeGridFloor = officeGrid.box(0,0,64,33)
export const officeGridCorridor = officeGrid.box(1,12,63,9)
export const officeGridNorthRooms = [0,16,32,48].map(x=>officeGrid.box(x,0,16,12))
export const officeGridSouthRooms = [0,16,32,48].map(x=>officeGrid.box(x,21,16,12))
export const officeGridDoorColumns = [13,19,45,51] as const

