import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/visualTokens.css'
import App from './App.jsx'
import ThemeLab from './views/ThemeLab.jsx'
import PlaceStageLab from './views/PlaceStageLab.tsx'
import { isThemeLabEnabled } from './theme/themeLabModel'
import { isPlaceStageLabEnabled } from './center-next/place-stage/placeStageLabModel'

// 开发验收入口:?theme-lab=1 / ?place-stage=1 时只渲染对应实验台,
// 不挂载 App,因此不触碰 currentView、历史记录与正式流程。
// ?horizon-lab=1 是 place-stage 的兼容别名,进入同一个实验台。
const search = window.location.search
const showThemeLab = isThemeLabEnabled(search)
const showPlaceStageLab = !showThemeLab && isPlaceStageLabEnabled(search)

function Root() {
  if (showThemeLab) return <ThemeLab />
  if (showPlaceStageLab) return <PlaceStageLab />
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
