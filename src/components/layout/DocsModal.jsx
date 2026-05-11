import { motion, AnimatePresence } from 'framer-motion'
import { X, Book, Cpu, Zap, Shield, Search } from 'lucide-react'
import { Button } from '../ui/Button'

export const DocsModal = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-zinc-900 bg-zinc-950 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-900 bg-zinc-900/20 px-4 py-4 sm:px-8 sm:py-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
                  <Book size={20} className="text-black" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Documentation</h3>
                  <p className="text-xs text-zinc-500">Technical guide to RepoMind Intelligence</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-full transition-colors">
                <X size={20} className="text-zinc-400" />
              </button>
            </div>

            <div className="flex-1 space-y-10 overflow-y-auto p-5 sm:space-y-12 sm:p-8">
              <section>
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap size={18} className="text-amber-500" />
                  What is RepoMind?
                </h4>
                <p className="text-zinc-400 leading-relaxed">
                  RepoMind is an AI-powered code search workspace that lets developers navigate complex repositories with natural language. It mixes fast local retrieval with Groq-based reranking so results follow meaning instead of exact wording alone.
                </p>
              </section>

              <section className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Cpu size={16} />
                    Search Engine Logic
                  </h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    RepoMind first retrieves the best local candidates, then asks Groq to semantically rank the shortlist. 
                  </p>
                  <ul className="text-sm text-zinc-500 space-y-2 list-disc pl-4">
                    <li>Chunking by functions, classes, components, hooks, and handlers</li>
                    <li>BM25, fuzzy, and metadata scoring for local candidate retrieval</li>
                    <li>Groq reranking over only the top code snippets</li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Search size={16} />
                    Search Reliability
                  </h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    The app always returns the closest local matches, even if Groq is unavailable or the user key is invalid. 
                  </p>
                  <ul className="text-sm text-zinc-500 space-y-2 list-disc pl-4">
                    <li>User-provided Groq keys are stored only in browser localStorage</li>
                    <li>Missing or invalid keys trigger a clean local-search fallback</li>
                    <li>Confidence and reasoning are surfaced directly in the UI</li>
                  </ul>
                </div>
              </section>

              <section>
                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Upload & Processing Flow</h4>
                <div className="relative border-l border-zinc-900 ml-3 space-y-8">
                  <div className="pl-8 relative">
                    <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-700" />
                    <h5 className="text-sm font-semibold text-zinc-200 mb-1">1. Archive Extraction</h5>
                    <p className="text-xs text-zinc-500">Zip files are extracted into a temporary backend workspace for indexing.</p>
                  </div>
                  <div className="pl-8 relative">
                    <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-700" />
                    <h5 className="text-sm font-semibold text-zinc-200 mb-1">2. Static Analysis & Filtering</h5>
                    <p className="text-xs text-zinc-500">Folders like node_modules and .git are ignored, and source files are chunked by code structure instead of fixed windows.</p>
                  </div>
                  <div className="pl-8 relative">
                    <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-700" />
                    <h5 className="text-sm font-semibold text-zinc-200 mb-1">3. Candidate Ranking & AI Review</h5>
                    <p className="text-xs text-zinc-500">Local retrieval scores candidates instantly, then Groq reranks the shortlist when a user key is provided.</p>
                  </div>
                </div>
              </section>

              <section className="p-6 rounded-2xl bg-zinc-900/30 border border-zinc-900">
                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Shield size={16} />
                  API Endpoints
                </h4>
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex gap-4">
                    <span className="text-emerald-500 w-12">POST</span>
                    <span className="text-zinc-300">/api/search</span>
                    <span className="text-zinc-600 italic">Local retrieval plus Groq reranking</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-blue-500 w-12">POST</span>
                    <span className="text-zinc-300">/api/upload-repo</span>
                    <span className="text-zinc-600 italic">Project zip ingestion</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-amber-500 w-12">GET</span>
                    <span className="text-zinc-300">/api/file-content</span>
                    <span className="text-zinc-600 italic">Read source file content</span>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end border-t border-zinc-900 bg-zinc-900/10 p-4 sm:p-6">
              <Button onClick={onClose}>Got it</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
