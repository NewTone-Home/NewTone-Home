import { useState } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { centerContentService } from './content/CenterContentService'

export function CenterDeveloperTools() {
  const enabled = new URLSearchParams(window.location.search).get('center-tools') === '1'
  const setCenterContentPackage = useProgressStore((state: any) => state.setCenterContentPackage)
  const [status, setStatus] = useState('')

  if (!enabled) return null

  const importFile = async (file: File | undefined) => {
    if (!file) return
    setStatus('导入中…')
    try {
      const imported = await centerContentService.importPackage(file)
      setCenterContentPackage(imported.manifest.id)
      setStatus(`已载入 ${imported.manifest.id}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '导入失败')
    }
  }

  return (
    <aside className="center-next-devtools">
      <label>
        导入 Center 内容包
        <input
          type="file"
          accept=".zip,.newtone"
          onChange={event => void importFile(event.currentTarget.files?.[0])}
        />
      </label>
      {status && <span>{status}</span>}
    </aside>
  )
}
