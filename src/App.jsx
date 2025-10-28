import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { ToastProvider } from "@/components/common/Toast"
import TurnstileWrapper from "@/components/common/TurnstileWrapper"
import { SpeedInsights } from "@vercel/speed-insights/react"

function App() {
  return (
    <ToastProvider>
      <TurnstileWrapper>
        <Pages />
        <Toaster />
        <SpeedInsights />
      </TurnstileWrapper>
    </ToastProvider>
  )
}

export default App 