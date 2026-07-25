import { lazy, Suspense } from 'react'

const CenterExperience = lazy(() => import('../center-next/CenterExperience'))

function Center() {
  return (
    <Suspense fallback={<main className="center-next center-next--loading">正在展开两层世界…</main>}>
      <CenterExperience />
    </Suspense>
  )
}

export default Center
