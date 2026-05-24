import { AppShell } from "./shell"

// App 仅负责挂载 AppShell
// 路由 / 配饰 / 错误边界都在 AppShell 内部
export default function App() {
  return <AppShell />
}
