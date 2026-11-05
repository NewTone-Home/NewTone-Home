import { createContext, createElement, useContext } from 'react'

const ReaderPreviewStoreScope = createContext(null)
// Root-local memory stores. This never installs a game storage capability.
export function ReaderPreviewStoreProvider({ stores, children }) {
  if (!stores?.progressStore || !stores?.narrativeStore) throw Error('INVALID_READER_PREVIEW_STORES')
  return createElement(ReaderPreviewStoreScope.Provider, { value: stores }, children)
}
export function useReaderStoreScope() { return useContext(ReaderPreviewStoreScope) }
