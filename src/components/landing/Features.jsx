import { FEATURES } from '../../data/mockData'
import { Search, Cpu, MessageSquare, Brain } from 'lucide-react'

const iconMap = {
  Search,
  Cpu,
  MessageSquare,
  Brain
}

export const Features = () => {
  return (
    <section id="features" className="py-24 px-6 bg-zinc-950">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Powerful semantic intelligence</h2>
          <p className="text-zinc-400">Everything you need to navigate complex codebases with ease.</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature, idx) => {
            const Icon = iconMap[feature.icon]
            return (
              <div key={idx} className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 hover:border-zinc-800 transition-all hover:-translate-y-1">
                <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-white" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export const HowItWorks = () => {
  const steps = [
    { title: 'Upload Repository', description: 'Connect your GitHub or upload a ZIP file.' },
    { title: 'Generate Embeddings', description: 'Our engine vectors your code structure and logic.' },
    { title: 'Semantic Matching', description: 'We map your natural language to code vectors.' },
    { title: 'Code Retrieval', description: 'Get relevant code snippets with explanations.' }
  ]

  return (
    <section id="how-it-works" className="py-24 px-6 border-t border-zinc-900">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16">How it works</h2>
        
        <div className="space-y-12 relative">
          <div className="absolute left-[27px] top-0 bottom-0 w-px bg-zinc-900" />
          
          {steps.map((step, idx) => (
            <div key={idx} className="relative pl-16">
              <div className="absolute left-0 top-0 w-14 h-14 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center z-10">
                <span className="text-sm font-bold text-zinc-500">{idx + 1}</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-zinc-400">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
