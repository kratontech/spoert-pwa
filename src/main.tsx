import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { initSync } from './lib/store'
import './index.css'

registerSW({ immediate: true })
if (localStorage.getItem('spoert.theme') === 'dark') document.documentElement.classList.add('dark')

initSync().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>,
  )
})
