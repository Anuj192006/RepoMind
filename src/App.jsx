import { useState } from 'react'
import { Navbar } from './components/layout/Navbar'
import { Hero } from './components/landing/Hero'
import { Workspace } from './components/workspace/Workspace'
import { DocsModal } from './components/layout/DocsModal'

function App() {
  const [view, setView] = useState('landing')
  const [showDocs, setShowDocs] = useState(false)

  const showWorkspace = () => setView('workspace')
  const showLanding = () => setView('landing')

  if (view === 'workspace') {
    return <Workspace onBack={showLanding} />
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      <Navbar onDemoClick={showWorkspace} onDocsClick={() => setShowDocs(true)} />
      <main>
        <Hero onDemoClick={showWorkspace} />
      </main>
      <DocsModal isOpen={showDocs} onClose={() => setShowDocs(false)} />
    </div>
  )
}

export default App
