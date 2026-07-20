import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/visualTokens.css'
import App from './App.jsx'
import ThemeLab from './views/ThemeLab.jsx'
import { isThemeLabEnabled } from './theme/themeLabModel'

// 开发验收入口:?theme-lab=1 时只渲染 Theme Lab,
// 不挂载 App,因此不触碰 currentView、历史记录与正式流程。
const showThemeLab = isThemeLabEnabled(window.location.search)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {showThemeLab ? <ThemeLab /> : <App />}
  </StrictMode>,
)
