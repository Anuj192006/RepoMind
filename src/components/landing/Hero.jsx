import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../ui/Button'
import { ArrowRight } from 'lucide-react'

export const Hero = ({ onDemoClick }) => {
  const [showArch, setShowArch] = useState(false)

  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-zinc-900/50 to-transparent pointer-events-none -z-10" />
      
      <div className="max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Backend Online
          </span>
          
          <h1 className="mb-6 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl md:text-7xl">
            Understand Codebases <br /> in Plain English
          </h1>
          
          <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg md:text-xl">
            Search repositories by meaning, not keywords. RepoMind narrows code candidates locally, then uses Groq AI to rerank the snippets that actually answer your question.
          </p>
          
          <div className="mb-16 flex flex-col items-stretch justify-center gap-4 sm:mb-20 sm:flex-row sm:items-center">
            <Button onClick={onDemoClick} size="lg" className="group w-full sm:w-auto">
              Open Workspace
              <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => setShowArch(true)} className="w-full sm:w-auto">View Architecture</Button>
          </div>
        </motion.div>

        <AnimatePresence>
          {showArch && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-6"
              onClick={() => setShowArch(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-2xl rounded-2xl border border-zinc-900 bg-zinc-950 p-5 text-left shadow-2xl sm:p-8"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-2xl font-bold mb-6">System Architecture</h3>
                <div className="space-y-6 text-zinc-400">
                  <div>
                    <h4 className="text-white font-medium mb-2">1. Parsing & Chunking</h4>
                    <p>The backend scans the uploaded repository, filters unnecessary files, and chunks source code by functions, classes, components, hooks, API handlers, and file-level fallbacks.</p>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-2">2. Local Candidate Retrieval</h4>
                    <p>RepoMind scores the in-memory code chunks with BM25, fuzzy matching, and symbol or path overlap to produce a strong shortlist without shipping the whole codebase to the model.</p>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-2">3. Groq AI Reranking</h4>
                    <p>Only the top candidates are sent to Groq, which returns strict JSON describing the most relevant snippets, confidence, and a short explanation for each match.</p>
                  </div>
                </div>
                <Button className="mt-8 w-full" onClick={() => setShowArch(false)}>Close</Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative group max-w-4xl mx-auto"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden shadow-2xl shadow-black/50">
            <img 
              src="/hero.png" 
              alt="RepoMind Dashboard Mockup" 
              className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-[1.02]"
            />
            {/* Subtle overlay to blend it in */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/20 to-transparent pointer-events-none" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
