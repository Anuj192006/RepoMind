import { Brain } from 'lucide-react'

export const Testimonials = () => {
  const quotes = [
    { text: "RepoMind cut our onboarding time by 60%. New devs can find exactly where logic lives without asking for help.", author: "Sarah Chen", role: "VP Engineering, Vercel" },
    { text: "The semantic search is a game changer. It actually understands our patterns and architecture, not just text matches.", author: "Marcus Thorne", role: "Staff Engineer, Stripe" },
    { text: "I can't imagine auditing a legacy codebase without this. It's like having a senior dev who knows every line.", author: "Elena Rossi", role: "Security Researcher" },
  ]

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          {quotes.map((q, i) => (
            <div key={i} className="p-8 rounded-2xl border border-zinc-900 bg-zinc-950/50">
              <p className="text-zinc-300 italic mb-6 leading-relaxed">"{q.text}"</p>
              <div>
                <p className="font-semibold text-white">{q.author}</p>
                <p className="text-sm text-zinc-500">{q.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export const Footer = () => {
  return (
    <footer className="py-20 px-6 border-t border-zinc-900 bg-black">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-12 mb-20">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                <Brain size={20} className="text-black" />
              </div>
              <span className="text-lg font-semibold tracking-tight">RepoMind</span>
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed">
              The next generation of semantic code intelligence. Built for high-performance engineering teams.
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
            <div>
              <h4 className="text-sm font-semibold mb-6">Product</h4>
              <ul className="space-y-4 text-sm text-zinc-500">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Workspace</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-6">Company</h4>
              <ul className="space-y-4 text-sm text-zinc-500">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-6">Legal</h4>
              <ul className="space-y-4 text-sm text-zinc-500">
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
          <p>© 2026 RepoMind Technologies Inc.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-zinc-400">Twitter</a>
            <a href="#" className="hover:text-zinc-400">GitHub</a>
            <a href="#" className="hover:text-zinc-400">LinkedIn</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
