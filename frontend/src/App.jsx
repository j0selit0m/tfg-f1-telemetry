import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [backendStatus, setBackendStatus] = useState("Esperando datos de telemetría...")
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Hacemos el fetch a nuestro backend de FastAPI
    fetch('http://localhost:8000/api/status')
      .then(response => response.json())
      .then(data => {
        setBackendStatus(data.message)
        setIsConnected(true)
      })
      .catch(error => {
        console.error("Error en la conexión:", error)
        setBackendStatus("Error: No hay señal del pit wall. Revisa FastAPI.")
        setIsConnected(false)
      })
  }, [])

  return (
    <div className="App" style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>🏎️ Dashboard TFG Fórmula 1</h1>
      
      <div style={{ 
        marginTop: '2rem', 
        padding: '1.5rem', 
        backgroundColor: '#1e1e1e', 
        color: 'white',
        borderRadius: '8px',
        borderLeft: isConnected ? '5px solid #4ade80' : '5px solid #ef4444'
      }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>Estado del Sistema</h3>
        <p style={{ margin: 0, fontSize: '1.2rem' }}>
          {isConnected ? '🟢' : '🔴'} {backendStatus}
        </p>
      </div>
    </div>
  )
}

export default App