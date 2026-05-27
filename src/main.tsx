import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/clarity.css'
import './components/charts/setup'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
