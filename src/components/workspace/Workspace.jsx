import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Folder, File, History, Hash, Clock, ArrowLeft, Upload, RefreshCw, FileCode, Terminal, AlertCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import Editor from '@monaco-editor/react'
import { apiRequest, getApiBaseUrl, getErrorMessage } from '../../lib/api'

const API_BASE_URL = getApiBaseUrl()
const TREE_TIMEOUT_MS = 70000
const SEARCH_TIMEOUT_MS = 90000
const UPLOAD_TIMEOUT_MS = 180000
const BACKEND_WAIT_DELAY_MS = 1500
const GROQ_KEY_STORAGE_KEY = 'repomind.groq_api_key'

const loadStoredGroqApiKey = () => {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(GROQ_KEY_STORAGE_KEY) || ''
}

const FileTree = ({ items, level = 0, onFileClick, selectedPath }) => {
  if (!items) return null

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.id}>
          <div
            onClick={() => item.type === 'file' && onFileClick(item.id)}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
              selectedPath === item.id
                ? 'bg-white/10 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
          >
            {item.type === 'folder' ? (
              <Folder size={14} className="text-zinc-500" />
            ) : (
              <File size={14} className={selectedPath === item.id ? 'text-white' : 'text-zinc-600'} />
            )}
            <span className="truncate">{item.name}</span>
          </div>
          {item.children && (
            <FileTree
              items={item.children}
              level={level + 1}
              onFileClick={onFileClick}
              selectedPath={selectedPath}
            />
          )}
        </div>
      ))}
    </div>
  )
}

const SearchResultCard = ({ result, onClick, isActive }) => {
  const confidence = Math.round((result.confidence ?? result.score ?? 0) * 100)

  return (
    <motion.div
      layout
      onClick={onClick}
      className={`p-4 rounded-xl border transition-all cursor-pointer ${
        isActive
          ? 'border-white bg-zinc-900/50'
          : 'border-zinc-900 bg-zinc-900/10 hover:border-zinc-800'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <File size={14} className="text-zinc-500" />
          <span className="text-sm font-medium text-zinc-300 truncate max-w-[200px]">{result.file_name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium tracking-wider uppercase">
            {confidence}% Confidence
          </span>
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 font-mono truncate mb-2">{result.path}</p>
      <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2 mb-2">{result.explanation}</p>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2">
        <span>{result.symbol_name || result.symbol_kind}</span>
        <span>Lines {result.start_line}-{result.end_line}</span>
      </div>
      <div className="text-[11px] text-zinc-500 leading-relaxed whitespace-pre-wrap line-clamp-4 font-mono">
        {result.preview}
      </div>
    </motion.div>
  )
}

const StatusBanner = ({ tone = 'neutral', title, message, detail, actionLabel, onAction, loading = false }) => {
  const toneStyles = {
    neutral: 'bg-zinc-900/60 border-zinc-800 text-zinc-300',
    info: 'bg-sky-500/10 border-sky-500/20 text-sky-100',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-100',
    error: 'bg-rose-500/10 border-rose-500/20 text-rose-100',
  }

  return (
    <div className={`p-3 rounded-xl border ${toneStyles[tone] || toneStyles.neutral}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <AlertCircle size={14} />}
            <span className="text-[10px] font-bold uppercase tracking-wider">{title}</span>
          </div>
          <p className="text-[11px] leading-relaxed">{message}</p>
          {detail && <p className="text-[10px] text-zinc-500 font-mono mt-2 break-all">{detail}</p>}
        </div>
        {actionLabel && onAction ? (
          <Button variant="outline" size="sm" onClick={onAction} className="shrink-0 gap-2">
            <RefreshCw size={12} />
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export const Workspace = ({ onBack }) => {
  const [query, setQuery] = useState('')
  const [groqApiKey, setGroqApiKey] = useState(loadStoredGroqApiKey)
  const [showGroqApiKey, setShowGroqApiKey] = useState(false)
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedResult, setSelectedResult] = useState(null)
  const [repoTree, setRepoTree] = useState([])
  const [selectedFilePath, setSelectedFilePath] = useState(null)
  const [fileContent, setFileContent] = useState(null)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [apiError, setApiError] = useState('')
  const [backendIndexStatus, setBackendIndexStatus] = useState('idle')
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isWaitingOnBackend, setIsWaitingOnBackend] = useState(false)
  const [backendWaitMessage, setBackendWaitMessage] = useState('')
  const fileInputRef = useRef(null)
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const decorationIdsRef = useRef([])
  const hasInitializedRef = useRef(false)
  const activeBackendRequestsRef = useRef(0)
  const backendWaitTimerRef = useRef(null)
  const normalizedSearchMessage = searchMessage.toLowerCase()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const trimmedKey = groqApiKey.trim()
    if (trimmedKey) {
      window.localStorage.setItem(GROQ_KEY_STORAGE_KEY, trimmedKey)
    } else {
      window.localStorage.removeItem(GROQ_KEY_STORAGE_KEY)
    }
  }, [groqApiKey])

  const withBackendLoader = useCallback(async (request, waitMessage) => {
    activeBackendRequestsRef.current += 1
    setBackendWaitMessage(waitMessage)

    if (activeBackendRequestsRef.current === 1) {
      backendWaitTimerRef.current = window.setTimeout(() => {
        setIsWaitingOnBackend(true)
      }, BACKEND_WAIT_DELAY_MS)
    }

    try {
      return await request()
    } finally {
      activeBackendRequestsRef.current = Math.max(0, activeBackendRequestsRef.current - 1)

      if (activeBackendRequestsRef.current === 0) {
        if (backendWaitTimerRef.current) {
          window.clearTimeout(backendWaitTimerRef.current)
          backendWaitTimerRef.current = null
        }
        setIsWaitingOnBackend(false)
        setBackendWaitMessage('')
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (backendWaitTimerRef.current) {
        window.clearTimeout(backendWaitTimerRef.current)
      }
    }
  }, [])

  const loadFileContent = useCallback(async (path) => {
    return withBackendLoader(
      () => apiRequest('/file-content', {
        searchParams: { path },
        timeoutMs: TREE_TIMEOUT_MS,
      }),
      'Opening file preview. The backend may still be waking up on Render.',
    )
  }, [withBackendLoader])

  const fetchBackendState = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsBootstrapping(true)
    }

    try {
      const [health, tree] = await withBackendLoader(
        () => Promise.all([
          apiRequest('/health', { timeoutMs: TREE_TIMEOUT_MS }),
          apiRequest('/tree', { timeoutMs: TREE_TIMEOUT_MS }),
        ]),
        'Waking up the backend. Render free instances can take up to a minute to respond.',
      )

      setRepoTree(tree)
      setApiError('')

      const nextIndexStatus = health?.index_status?.status || 'ready'
      setBackendIndexStatus(nextIndexStatus)

      if (nextIndexStatus === 'indexing') {
        setStatusMessage(health.index_status.message || 'The semantic index is still warming up.')
      } else if (nextIndexStatus === 'error') {
        setStatusMessage(health.index_status.message || 'The backend failed to build the semantic index.')
      } else if (statusMessage.startsWith('Building semantic index')) {
        setStatusMessage('')
      }
    } catch (error) {
      setRepoTree([])
      setBackendIndexStatus('offline')
      setApiError(getErrorMessage(error, `Unable to reach the backend at ${API_BASE_URL}.`))
    } finally {
      if (!silent) {
        setIsBootstrapping(false)
      }
    }
  }, [statusMessage, withBackendLoader])

  useEffect(() => {
    if (hasInitializedRef.current) return

    hasInitializedRef.current = true
    fetchBackendState()
  }, [fetchBackendState])

  useEffect(() => {
    if (backendIndexStatus !== 'indexing') return

    const timeoutId = window.setTimeout(() => {
      fetchBackendState({ silent: true })
    }, 3000)

    return () => window.clearTimeout(timeoutId)
  }, [backendIndexStatus, fetchBackendState])

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return

    if (!selectedResult || !fileContent || fileContent.path !== selectedResult.path) {
      decorationIdsRef.current = editorRef.current.deltaDecorations(decorationIdsRef.current, [])
      return
    }

    const startLine = selectedResult.start_line || 1
    const endLine = selectedResult.end_line || startLine
    const model = editorRef.current.getModel()
    const endColumn = model?.getLineMaxColumn(endLine) || 1

    editorRef.current.setPosition({ lineNumber: startLine, column: 1 })
    editorRef.current.setSelection({
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn,
    })
    decorationIdsRef.current = editorRef.current.deltaDecorations(decorationIdsRef.current, [
      {
        range: new monacoRef.current.Range(startLine, 1, endLine, endColumn),
        options: {
          isWholeLine: true,
          className: 'repomind-match-range',
          marginClassName: 'repomind-match-margin',
        },
      },
    ])
    editorRef.current.revealLineInCenter(startLine)
    editorRef.current.focus()
  }, [fileContent, selectedResult])

  const openSearchResult = async (result) => {
    setSelectedResult(result)
    setSelectedFilePath(result.path)
    setIsLoadingFile(true)
    setApiError('')

    try {
      const data = await loadFileContent(result.path)
      setFileContent(data)
    } catch (error) {
      setApiError(getErrorMessage(error, 'Failed to load the selected file.'))
    } finally {
      setIsLoadingFile(false)
    }
  }

  const handleFileClick = async (path) => {
    setSelectedResult(null)
    setSelectedFilePath(path)
    setIsLoadingFile(true)
    setApiError('')

    try {
      const data = await loadFileContent(path)
      setFileContent(data)
    } catch (error) {
      setApiError(getErrorMessage(error, 'Failed to fetch file content.'))
    } finally {
      setIsLoadingFile(false)
    }
  }

  const handleSearch = async (e) => {
    if (e) e.preventDefault()
    if (!query.trim()) return

    setIsSearching(true)
    setSearchMessage('')
    setApiError('')

    try {
      const data = await withBackendLoader(
        () => apiRequest('/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.trim(),
            groqApiKey: groqApiKey.trim() || undefined,
          }),
          timeoutMs: SEARCH_TIMEOUT_MS,
        }),
        'Waiting for the backend search service to respond. Render cold starts can take around 50 seconds.',
      )

      setResults(data.results || [])
      setSearchMessage(data.message || '')

      if ((data.results || []).length > 0) {
        await openSearchResult(data.results[0])
      } else {
        setSelectedResult(null)
      }
    } catch (error) {
      setResults([])
      setSelectedResult(null)
      setSearchMessage('')
      setApiError(getErrorMessage(error, 'Search failed.'))
    } finally {
      setIsSearching(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsUploading(true)
    setApiError('')
    setSearchMessage('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const data = await withBackendLoader(
        () => apiRequest('/upload-repo', {
          method: 'POST',
          body: formData,
          timeoutMs: UPLOAD_TIMEOUT_MS,
        }),
        'Uploading your project and waiting for the backend to respond. The first request may take a while on Render.',
      )

      await fetchBackendState({ silent: true })
      setResults([])
      setSelectedResult(null)
      setFileContent(null)
      setSelectedFilePath(null)
      setStatusMessage(data.message || 'Repository indexed successfully.')
    } catch (error) {
      setApiError(getErrorMessage(error, 'Upload failed.'))
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleReset = async () => {
    setApiError('')

    try {
      const data = await withBackendLoader(
        () => apiRequest('/reset', { timeoutMs: SEARCH_TIMEOUT_MS }),
        'Reloading the sample repository. The backend may still be waking up.',
      )
      await fetchBackendState({ silent: true })
      setResults([])
      setSelectedResult(null)
      setFileContent(null)
      setSelectedFilePath(null)
      setSearchMessage('')
      setStatusMessage(data.message || 'Sample repository reloaded.')
    } catch (error) {
      setApiError(getErrorMessage(error, 'Reset failed.'))
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col overflow-x-hidden lg:h-screen lg:overflow-hidden">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".zip"
        className="hidden"
      />

      <header className="border-b border-zinc-900 bg-zinc-950/50 px-3 py-3 sm:h-14 sm:px-4 sm:py-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button onClick={onBack} className="p-2 hover:bg-zinc-900 rounded-md transition-colors">
            <ArrowLeft size={18} className="text-zinc-400" />
          </button>
          <div className="hidden h-4 w-px bg-zinc-800 sm:block" />
          <div className="flex min-w-0 items-center gap-2">
            <Hash size={16} className="text-zinc-500" />
            <span className="truncate text-xs font-medium uppercase tracking-wider text-zinc-300">RepoMind / active-workspace</span>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button variant="outline" size="sm" onClick={handleReset} className="flex-1 justify-center gap-2 sm:flex-none">
            <RefreshCw size={14} />
            Sample Repo
          </Button>
          <Button variant="primary" size="sm" onClick={handleUploadClick} disabled={isUploading} className="flex-1 justify-center gap-2 sm:flex-none">
            {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload Project
          </Button>
        </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden lg:min-h-0 lg:flex-row">
        <aside className="w-full border-b border-zinc-900 bg-zinc-950/20 lg:w-64 lg:min-w-64 lg:border-b-0 lg:border-r lg:overflow-hidden">
          <div className="p-4 border-b border-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Repository</span>
            </div>
            <div className="overflow-y-auto pr-1 max-h-48 sm:max-h-60 lg:max-h-[calc(100vh-300px)]">
              {apiError ? (
                <StatusBanner
                  tone="error"
                  title="Backend Offline"
                  message={apiError}
                  detail={`API base: ${API_BASE_URL}`}
                  actionLabel="Retry"
                  onAction={() => fetchBackendState()}
                />
              ) : repoTree.length > 0 ? (
                <FileTree
                  items={repoTree}
                  onFileClick={handleFileClick}
                  selectedPath={selectedFilePath || selectedResult?.path}
                />
              ) : (
                <div className="py-8 text-center px-4">
                  <RefreshCw size={24} className={`text-zinc-800 mx-auto mb-2 ${isBootstrapping ? 'animate-spin' : ''}`} />
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                    {isBootstrapping ? 'Loading tree...' : 'No repository loaded'}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="hidden p-4 md:flex md:flex-col md:gap-4 md:overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">History</span>
              <History size={12} className="text-zinc-600" />
            </div>
            <div className="space-y-3 overflow-y-auto">
              {[
                { q: 'authentication logic' },
                { q: 'retry mechanism' },
                { q: 'binary search' },
              ].map((h, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setQuery(h.q)
                    setSearchMessage('')
                  }}
                  className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  <Clock size={12} />
                  <span className="truncate">{h.q}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 bg-zinc-950/10">
          <div className="p-4 sm:p-6">
            <form onSubmit={handleSearch} className="relative group">
              <div className="pointer-events-none absolute inset-0 bg-white/5 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 shadow-2xl transition-all focus-within:border-zinc-700 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Search size={20} className="text-zinc-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask a question about the codebase..."
                    className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-zinc-600"
                  />
                </div>
                <Button type="submit" size="sm" className="w-full justify-center sm:w-auto sm:shrink-0" disabled={isSearching}>
                  {isSearching ? <RefreshCw size={14} className="animate-spin" /> : 'Search'}
                </Button>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['auth', 'retry', 'binary search', 'validation', 'knapsack'].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setQuery(term)
                      setSearchMessage('')
                    }}
                    className="px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-500 hover:text-white transition-colors whitespace-nowrap"
                  >
                    {term}
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-2xl border border-zinc-900 bg-zinc-950/40 px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Groq API Key</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Saved locally and sent only with AI search requests.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGroqApiKey((value) => !value)}
                    className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showGroqApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type={showGroqApiKey ? 'text' : 'password'}
                    value={groqApiKey}
                    onChange={(e) => setGroqApiKey(e.target.value)}
                    placeholder="Paste your Groq API key"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-700"
                  />
                  {groqApiKey ? (
                    <button
                      type="button"
                      onClick={() => setGroqApiKey('')}
                      className="rounded-xl border border-zinc-800 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-300 sm:shrink-0"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
            </form>
            {isWaitingOnBackend ? (
              <div className="mt-4">
                <StatusBanner
                  tone="info"
                  title="Waking Backend"
                  message={backendWaitMessage || 'Waiting for the backend to respond.'}
                  detail={API_BASE_URL}
                  loading
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col xl:min-h-0 xl:flex-row">
            <div className={`w-full space-y-4 overflow-y-auto border-zinc-900 p-4 pt-0 sm:p-6 sm:pt-0 xl:w-[380px] xl:min-w-[380px] xl:border-r ${
              fileContent ? 'max-h-[42vh] border-b xl:max-h-none xl:border-b-0' : 'flex-1'
            }`}>
              {apiError ? (
                <StatusBanner
                  tone="error"
                  title="API Connection"
                  message={apiError}
                  detail={`Requests are targeting ${API_BASE_URL}`}
                  actionLabel="Retry"
                  onAction={() => fetchBackendState()}
                />
              ) : null}

              {!apiError && statusMessage ? (
                <StatusBanner
                  tone={backendIndexStatus === 'error' ? 'error' : backendIndexStatus === 'indexing' ? 'info' : 'neutral'}
                  title={backendIndexStatus === 'indexing' ? 'Indexing' : backendIndexStatus === 'error' ? 'Backend Error' : 'Workspace'}
                  message={statusMessage}
                />
              ) : null}

              {!apiError && searchMessage && results.length === 0 ? (
                <StatusBanner
                  tone={searchMessage.toLowerCase().includes('indexing') ? 'info' : 'warning'}
                  title={searchMessage.toLowerCase().includes('indexing') ? 'Backend Starting' : 'No Results Yet'}
                  message={searchMessage}
                />
              ) : null}

              <AnimatePresence mode="wait">
                {isSearching ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-32 bg-zinc-900/50 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : results.length > 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    {searchMessage ? (
                      <StatusBanner
                        tone="warning"
                        title={normalizedSearchMessage.includes('groq api key') ? 'AI Search Disabled' : normalizedSearchMessage.includes('groq') ? 'AI Search Fallback' : 'Search Notice'}
                        message={searchMessage}
                      />
                    ) : null}
                    {results.map((res) => (
                      <SearchResultCard
                        key={res.id}
                        result={res}
                        isActive={selectedResult?.id === res.id}
                        onClick={() => openSearchResult(res)}
                      />
                    ))}
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center mb-4">
                      <Search size={24} className="text-zinc-700" />
                    </div>
                    <h3 className="text-zinc-300 font-medium mb-1">Start your search</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-2">Explore logic across files</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex min-h-[320px] flex-1 flex-col bg-zinc-950/50 min-w-0 xl:min-h-0">
              {fileContent ? (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-900/10 px-4 py-3 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
                        <FileCode size={14} className="text-zinc-400" />
                      </div>
                      <span className="truncate text-xs font-mono text-zinc-400">{fileContent.path}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 font-bold uppercase tracking-widest">
                        {fileContent.language}
                      </div>
                    </div>
                  </div>
                  <div className="relative flex-1 min-h-[320px] xl:min-h-0">
                    {isLoadingFile ? (
                      <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                        <RefreshCw size={24} className="text-white animate-spin" />
                      </div>
                    ) : null}
                    <Editor
                      height="100%"
                      language={fileContent.language}
                      value={fileContent.content}
                      onMount={(editor, monaco) => {
                        editorRef.current = editor
                        monacoRef.current = monaco
                      }}
                      theme="vs-dark"
                      options={{
                        readOnly: true,
                        minimap: { enabled: true, scale: 0.75 },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        padding: { top: 20 },
                        backgroundColor: '#00000000',
                        family: 'JetBrains Mono, monospace',
                        lineNumbersMinChars: 4,
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-4 text-zinc-800">
                  <Terminal size={64} className="opacity-5 mb-4" />
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-20">Select a file to preview</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
