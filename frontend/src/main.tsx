import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { PreferencesProvider } from './i18n'
import './styles.css'
import './styles-extra.css'

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 15000, retry: 1 } } })
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={client}><PreferencesProvider><App /></PreferencesProvider></QueryClientProvider></StrictMode>)
