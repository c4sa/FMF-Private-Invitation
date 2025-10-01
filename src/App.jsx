import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { ToastProvider } from "@/components/common/Toast"

function App() {
  return (
    <ToastProvider>
      <Pages />
      <Toaster />
    </ToastProvider>
  )
}

export default App 