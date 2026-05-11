import { Button } from '../ui/Button'
import { Brain } from 'lucide-react'

export const Navbar = ({ onDemoClick, onDocsClick }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-900 bg-black/50 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
      <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
          <Brain size={20} className="text-black" />
        </div>
        <span className="truncate text-base font-semibold tracking-tight sm:text-lg">RepoMind</span>
      </div>
      
      <div className="hidden md:flex items-center gap-8">
        <a href="https://github.com/anujupadhyay/RepoMind" target="_blank" rel="noreferrer" className="text-sm text-zinc-400 hover:text-white transition-colors">GitHub</a>
        <button onClick={onDocsClick} className="text-sm text-zinc-400 hover:text-white transition-colors">Docs</button>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Button onClick={onDemoClick} size="sm" className="whitespace-nowrap">Open Workspace</Button>
      </div>
      </div>
    </nav>
  )
}
