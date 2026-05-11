# RepoMind

RepoMind is an AI-powered codebase search tool. It parses an uploaded repository, chunks code by meaningful symbols, retrieves local candidates, and then uses a user-provided Groq API key to semantically rerank the best matches.

## How Search Works

1. Upload a `.zip` project.
2. The backend ignores heavy/unnecessary paths such as `node_modules`, `.git`, `dist`, `build`, `.next`, lock files, and image asset folders.
3. Source files are chunked by functions, classes, components, hooks, route handlers, API functions, utility functions, or file-level fallback chunks.
4. Chunks are stored in backend memory for the active session.
5. Search first retrieves the best local candidates with BM25 + fuzzy/path/symbol scoring.
6. If the user added a Groq API key, the top candidates are sent to Groq for semantic reranking.
7. If the key is missing or invalid, RepoMind falls back cleanly to local results without crashing.

## Stack

- Frontend: React, Vite, Tailwind, Framer Motion, Monaco Editor
- Backend: FastAPI, httpx
- AI search: Groq chat completion reranking with `llama-3.1-8b-instant` by default

## Run Locally

1. Install frontend dependencies:
```bash
npm install
```

2. Install backend dependencies:
```bash
pip install -r backend/requirements.txt
```

3. Start the app:
```bash
npm run dev
```

The frontend runs on Vite and calls `/api`. In development, Vite proxies `/api` to the FastAPI backend.

## Frontend API Key Behavior

- The Groq API key is entered in the UI.
- It is stored only in browser `localStorage`.
- It is never hardcoded in the repo.
- It is only sent with AI search requests.
- Upload, tree, reset, and file-content requests do not include the key.

## Environment

Optional values are documented in [.env.example](/Users/anujupadhyay/Desktop/RepoMind/.env.example:1):

```bash
VITE_API_BASE_URL=/api
VITE_DEV_BACKEND_URL=http://127.0.0.1:8000
GROQ_MODEL=llama-3.1-8b-instant
```

- `VITE_API_BASE_URL`: Browser API base. Use `/api` when frontend and backend are behind the same host.
- `VITE_DEV_BACKEND_URL`: Local backend target for the Vite proxy.
- `GROQ_MODEL`: Backend Groq model used for reranking.
- `CORS_ALLOW_ORIGINS`: Optional comma-separated CORS allowlist.
- `REPO_BACKEND_PORT`: Optional backend port override.

## Deployment

### Single service

The backend can serve the built frontend from `dist/`, so a single container or single process deployment works.

Build the frontend:
```bash
npm run build
```

Start the backend:
```bash
python3 backend/run_backend.py
```

### Docker

Build and run:

```bash
docker build -t repomind .
docker run -p 8000:8000 repomind
```

### Split frontend/backend deployment

- Serve the Vite frontend normally.
- Run the FastAPI backend separately.
- Reverse proxy `/api/*` to the backend.

## API Routes

- `GET /api/health`
- `GET /api/tree`
- `GET /api/file-content?path=...`
- `POST /api/upload-repo`
- `GET /api/reset`
- `POST /api/search`

Search request body:

```json
{
  "query": "where login happens",
  "groqApiKey": "user_provided_key"
}
```

## Result Shape

Each search result includes:

- file name
- file path
- matched symbol name and kind
- start and end line
- confidence score
- AI/local explanation
- preview snippet

## Notes

- The backend no longer depends on OpenAI embeddings, `sentence-transformers`, `transformers`, or `torch`.
- If Groq is unavailable, the app still returns local code search results and shows a clean UI message.
- Clicking a result opens the file in Monaco, scrolls to the match, and highlights the matched range.
