import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { ToastProvider } from "@/components/common/Toast"
import TurnstileWrapper from "@/components/common/TurnstileWrapper"

function App() {
  return (
    <ToastProvider>
      <TurnstileWrapper>
        <Pages />
        <Toaster />
      </TurnstileWrapper>
    </ToastProvider>
  )
}

export default App 