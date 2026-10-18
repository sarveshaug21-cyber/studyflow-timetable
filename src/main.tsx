import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@/context/ThemeContext'
import { TimetableProvider } from '@/context/TimetableContext'
import { SettingsProvider } from '@/context/SettingsContext'
import { FocusProvider } from '@/context/FocusContext'
import App from './App'
import './index.css'
import 'temporal-polyfill'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <SettingsProvider>
        <TimetableProvider>
          <FocusProvider>
            <App />
          </FocusProvider>
        </TimetableProvider>
      </SettingsProvider>
    </ThemeProvider>
  </React.StrictMode>,
)