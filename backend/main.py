import ast
import json
import math
import os
import re
import shutil
import tempfile
import zipfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File as FastAPIFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

if load_dotenv is not None:
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class SearchQuery(BaseModel):
    query: str
    groqApiKey: Optional[str] = None


class SearchResult(BaseModel):
    id: str
    file_name: str
    path: str
    symbol_name: Optional[str] = None
    symbol_kind: str
    start_line: int
    end_line: int
    score: float
    confidence: float
    local_score: float
    explanation: str
    preview: str
    code: str
    language: str
    source: str


class SearchResponse(BaseModel):
    results: List[SearchResult]
    message: Optional[str] = None
    top_score: float = 0.0
    used_ai: bool = False
    ai_error: Optional[str] = None


def coerce_int(value: object) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def parse_allowed_origins() -> List[str]:
    raw_value = os.getenv("CORS_ALLOW_ORIGINS", "*").strip()
    if not raw_value:
        return ["*"]
    return [origin.strip() for origin in raw_value.split(",") if origin.strip()]


app = FastAPI(title="RepoMind Backend")
allow_origins = parse_allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
DEFAULT_FIXTURES_PATH = BACKEND_DIR / "fixtures"
FRONTEND_DIST_DIR = PROJECT_ROOT / "dist"
GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
LOCAL_CANDIDATE_LIMIT = 25
FINAL_RESULT_LIMIT = 8
UPLOAD_TIMEOUT_SECONDS = 120
GROQ_TIMEOUT_SECONDS = 45
MAX_GROQ_CHUNK_CHARS = 1800
MAX_FILE_SIZE_BYTES = 1_500_000

IGNORED_FOLDERS = {
    "node_modules",
    ".git",
    "dist",
    "build",
    "__pycache__",
    ".next",
    "venv",
    "env",
    ".vscode",
    ".idea",
    "coverage",
    "images",
    "image",
    "assets",
}

IGNORED_FILES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
}

SUPPORTED_EXTENSIONS = {
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
    ".py",
    ".cpp",
    ".c",
    ".h",
    ".hpp",
    ".java",
    ".go",
    ".rs",
    ".html",
    ".css",
    ".scss",
    ".json",
    ".md",
    ".yml",
    ".yaml",
    ".sql",
    ".sh",
}

STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "into",
    "this",
    "that",
    "true",
    "false",
    "null",
    "undefined",
    "const",
    "let",
    "var",
    "function",
    "class",
    "return",
    "await",
    "async",
    "public",
    "private",
    "protected",
    "static",
    "final",
    "void",
    "new",
    "self",
    "super",
    "req",
    "res",
    "next",
    "where",
    "which",
    "that",
}

RESERVED_KEYWORDS = {
    "if",
    "for",
    "while",
    "switch",
    "catch",
    "return",
    "else",
    "try",
    "do",
}

ROUTE_METHODS = ("get", "post", "put", "patch", "delete", "options", "head")
QUERY_EXPANSIONS = {
    "login": ["auth", "signin", "token", "credential", "session"],
    "authentication": ["auth", "login", "jwt", "token", "session", "credential"],
    "auth": ["authentication", "login", "jwt", "token", "session"],
    "api": ["endpoint", "request", "fetch", "axios", "http", "route"],
    "fetch": ["load", "query", "request", "api", "axios", "db"],
    "data": ["fetch", "load", "query", "db", "database", "select"],
    "payment": ["billing", "charge", "stripe", "checkout", "invoice", "transaction"],
    "dashboard": ["analytics", "stats", "summary", "overview"],
    "navbar": ["nav", "navigation", "header", "menu"],
    "component": ["react", "jsx", "tsx", "render", "ui"],
    "renders": ["render", "return", "component", "jsx"],
}

indexed_chunks: List[Dict] = []
doc_frequencies: Counter = Counter()
average_document_length = 0.0
current_repo_path = DEFAULT_FIXTURES_PATH
active_temp_dir: Optional[Path] = None
index_state = {
    "status": "idle",
    "message": "Waiting to index a repository.",
    "repo_path": str(DEFAULT_FIXTURES_PATH),
    "started_at": None,
    "completed_at": None,
    "chunk_count": 0,
}


JS_ROUTE_PATTERN = re.compile(
    r"^\s*(?:app|router)\.(get|post|put|patch|delete|options|head)\s*\(\s*['\"`]([^'\"`]+)['\"`]"
)
JS_CLASS_PATTERN = re.compile(r"^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)\b")
JS_FUNCTION_PATTERN = re.compile(
    r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\("
)
JS_ARROW_PATTERN = re.compile(
    r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>"
)
JS_METHOD_PATTERN = re.compile(r"^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^;]*\)\s*\{")

GO_FUNCTION_PATTERN = re.compile(r"^\s*func\s+(?:\([^)]+\)\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(")
GO_TYPE_PATTERN = re.compile(r"^\s*type\s+([A-Za-z_][A-Za-z0-9_]*)\s+(struct|interface)\b")

RUST_FUNCTION_PATTERN = re.compile(r"^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(")
RUST_STRUCT_PATTERN = re.compile(r"^\s*(?:pub\s+)?struct\s+([A-Za-z_][A-Za-z0-9_]*)\b")
RUST_IMPL_PATTERN = re.compile(r"^\s*impl(?:<[^>]+>)?\s+([A-Za-z_][A-Za-z0-9_:<>]*)")

C_LIKE_CLASS_PATTERN = re.compile(
    r"^\s*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)\b"
)
C_LIKE_FUNCTION_PATTERN = re.compile(
    r"^\s*(?:template\s*<[^>]+>\s*)?(?:[\w:\<\>\[\],~*&]+\s+)+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;]*\)\s*(?:const\s*)?\{"
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def update_index_state(
    status: str,
    *,
    message: Optional[str] = None,
    repo_path: Optional[Path] = None,
    chunk_count: Optional[int] = None,
) -> None:
    index_state["status"] = status
    if message is not None:
        index_state["message"] = message
    if repo_path is not None:
        index_state["repo_path"] = str(repo_path)
    if chunk_count is not None:
        index_state["chunk_count"] = chunk_count

    if status == "indexing":
        index_state["started_at"] = utc_now_iso()
        index_state["completed_at"] = None
    elif status in {"ready", "error"}:
        index_state["completed_at"] = utc_now_iso()


def cleanup_temp_repo() -> None:
    global active_temp_dir

    if active_temp_dir and active_temp_dir.exists():
        shutil.rmtree(active_temp_dir, ignore_errors=True)
    active_temp_dir = None


def is_ignored_directory(name: str) -> bool:
    return name.lower() in IGNORED_FOLDERS


def should_index_file(path: Path) -> bool:
    return (
        path.is_file()
        and path.name not in IGNORED_FILES
        and path.suffix.lower() in SUPPORTED_EXTENSIONS
        and path.stat().st_size <= MAX_FILE_SIZE_BYTES
    )


def get_language(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    mapping = {
        ".ts": "typescript",
        ".tsx": "typescript",
        ".mts": "typescript",
        ".cts": "typescript",
        ".js": "javascript",
        ".jsx": "javascript",
        ".mjs": "javascript",
        ".cjs": "javascript",
        ".cpp": "cpp",
        ".c": "cpp",
        ".h": "cpp",
        ".hpp": "cpp",
        ".py": "python",
        ".java": "java",
        ".go": "go",
        ".rs": "rust",
        ".html": "html",
        ".css": "css",
        ".scss": "css",
        ".json": "json",
        ".md": "markdown",
        ".sql": "sql",
        ".sh": "shell",
        ".yml": "yaml",
        ".yaml": "yaml",
    }
    return mapping.get(ext, "text")


def normalize_identifier(value: str) -> str:
    value = value.replace("\\", " ").replace("/", " ").replace(".", " ").replace("-", " ").replace("_", " ")
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", value)
    value = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip().lower()


def tokenize(value: str) -> List[str]:
    normalized = normalize_identifier(value)
    return [token for token in re.findall(r"[a-z0-9]+", normalized) if token and token not in STOPWORDS]


def unique_preserving_order(items: List[str]) -> List[str]:
    seen = set()
    unique_items = []

    for item in items:
        if item in seen:
            continue
        seen.add(item)
        unique_items.append(item)

    return unique_items


def extract_identifiers(text: str, limit: int = 80) -> List[str]:
    identifiers = re.findall(r"[A-Za-z_][A-Za-z0-9_]{2,}", text)
    expanded: List[str] = []

    for identifier in identifiers:
        expanded.extend(tokenize(identifier))

    filtered = [token for token in expanded if token not in RESERVED_KEYWORDS]
    return unique_preserving_order(filtered)[:limit]


def build_preview(content: str, max_lines: int = 8, max_chars: int = 420) -> str:
    trimmed_lines = content.strip().splitlines()[:max_lines]
    preview = "\n".join(trimmed_lines).strip()
    if len(preview) > max_chars:
        preview = preview[: max_chars - 3].rstrip() + "..."
    return preview


def build_query_terms(query: str) -> List[Tuple[str, float]]:
    original_terms = tokenize(query)
    weighted_terms: List[Tuple[str, float]] = []
    seen = set()

    for term in original_terms:
        if term not in seen:
            weighted_terms.append((term, 1.0))
            seen.add(term)

        for expanded in QUERY_EXPANSIONS.get(term, []):
            if expanded not in seen:
                weighted_terms.append((expanded, 0.6))
                seen.add(expanded)

    return weighted_terms


def make_chunk(
    relative_path: str,
    language: str,
    content_lines: List[str],
    symbol_name: Optional[str],
    symbol_kind: str,
    start_line: int,
    end_line: int,
) -> Dict:
    start_line = max(1, start_line)
    end_line = max(start_line, end_line)
    chunk_text = "\n".join(content_lines[start_line - 1 : end_line]).strip()
    file_name = Path(relative_path).name
    preview = build_preview(chunk_text)

    path_terms = tokenize(relative_path)
    symbol_terms = tokenize(symbol_name or "")
    identifier_terms = extract_identifiers(chunk_text, limit=50)
    all_terms = path_terms + symbol_terms + identifier_terms + tokenize(preview)
    term_freqs = Counter(all_terms)
    document_length = sum(term_freqs.values()) or 1

    return {
        "id": f"{relative_path}:{start_line}-{end_line}:{symbol_name or symbol_kind}",
        "file_name": file_name,
        "path": relative_path,
        "content": chunk_text,
        "language": language,
        "symbol_name": symbol_name,
        "symbol_kind": symbol_kind,
        "start_line": start_line,
        "end_line": end_line,
        "preview": preview,
        "path_terms": set(path_terms),
        "symbol_terms": set(symbol_terms),
        "term_freqs": term_freqs,
        "document_length": document_length,
        "search_text": normalize_identifier(" ".join([
            relative_path,
            symbol_name or "",
            symbol_kind,
            preview,
        ])),
    }


def dedupe_chunks(chunks: List[Dict]) -> List[Dict]:
    unique_chunks: Dict[Tuple[int, int, Optional[str], str], Dict] = {}

    for chunk in chunks:
        key = (
            chunk["start_line"],
            chunk["end_line"],
            chunk.get("symbol_name"),
            chunk["symbol_kind"],
        )
        if key not in unique_chunks:
            unique_chunks[key] = chunk

    return sorted(
        unique_chunks.values(),
        key=lambda chunk: (chunk["start_line"], chunk["end_line"], chunk.get("symbol_name") or ""),
    )


def find_brace_block_end(lines: List[str], start_index: int) -> int:
    brace_balance = 0
    saw_opening_brace = False

    for index in range(start_index, len(lines)):
        line = lines[index]
        open_count = line.count("{")
        close_count = line.count("}")

        if open_count:
            saw_opening_brace = True

        if saw_opening_brace:
            brace_balance += open_count - close_count
            if brace_balance <= 0:
                return index + 1
        elif index > start_index and line.rstrip().endswith(";"):
            return index + 1

    return len(lines)


def classify_js_symbol(symbol_name: Optional[str], relative_path: str, content: str, base_kind: str) -> str:
    if base_kind == "route_handler":
        return base_kind
    if base_kind == "class":
        return "class"

    name = symbol_name or ""

    if name.startswith("use") and len(name) > 3 and name[3].isupper():
        return "hook"

    if name[:1].isupper() or re.search(r"return\s*\(\s*<", content):
        return "component"

    if "/api/" in relative_path or "\\api\\" in relative_path or re.search(r"\b(req|request)\b.*\b(res|response)\b", content):
        return "api_function"

    if "utils" in relative_path or "helpers" in relative_path:
        return "utility_function"

    return "function"


def extract_python_chunks(content: str, relative_path: str, language: str) -> List[Dict]:
    lines = content.splitlines()
    chunks: List[Dict] = []

    try:
        tree = ast.parse(content)
    except SyntaxError:
        return chunks

    parent_map: Dict[ast.AST, ast.AST] = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parent_map[child] = parent

    nodes: List[ast.AST] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            if getattr(node, "lineno", None) and getattr(node, "end_lineno", None):
                nodes.append(node)

    nodes.sort(key=lambda node: (node.lineno, node.end_lineno))  # type: ignore[attr-defined]

    for node in nodes:
        parent = parent_map.get(node)
        symbol_kind = "class"
        symbol_name = getattr(node, "name", None)

        if isinstance(node, ast.ClassDef):
            symbol_kind = "class"
        else:
            symbol_kind = "method" if isinstance(parent, ast.ClassDef) else "function"
            decorators = []
            for decorator in getattr(node, "decorator_list", []):
                if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute):
                    decorators.append(decorator.func.attr.lower())
                elif isinstance(decorator, ast.Attribute):
                    decorators.append(decorator.attr.lower())
            if any(decorator in ROUTE_METHODS for decorator in decorators):
                symbol_kind = "route_handler"
            elif "api" in relative_path.replace("\\", "/").split("/"):
                symbol_kind = "api_function"

        chunks.append(
            make_chunk(
                relative_path,
                language,
                lines,
                symbol_name,
                symbol_kind,
                node.lineno,  # type: ignore[attr-defined]
                node.end_lineno,  # type: ignore[attr-defined]
            )
        )

    return dedupe_chunks(chunks)


def extract_javascript_chunks(content: str, relative_path: str, language: str) -> List[Dict]:
    lines = content.splitlines()
    chunks: List[Dict] = []

    for index, line in enumerate(lines):
        symbol_name: Optional[str] = None
        base_kind: Optional[str] = None

        route_match = JS_ROUTE_PATTERN.match(line)
        if route_match:
            method, route_path = route_match.groups()
            symbol_name = f"{method.upper()} {route_path}"
            base_kind = "route_handler"
        else:
            for pattern, candidate_kind in (
                (JS_CLASS_PATTERN, "class"),
                (JS_FUNCTION_PATTERN, "function"),
                (JS_ARROW_PATTERN, "function"),
                (JS_METHOD_PATTERN, "method"),
            ):
                match = pattern.match(line)
                if not match:
                    continue
                candidate_name = match.group(1)
                if candidate_name in RESERVED_KEYWORDS:
                    continue
                symbol_name = candidate_name
                base_kind = candidate_kind
                break

        if not base_kind:
            continue

        end_line = find_brace_block_end(lines, index)
        symbol_kind = classify_js_symbol(
            symbol_name,
            relative_path,
            "\n".join(lines[index:end_line]),
            base_kind,
        )
        chunks.append(
            make_chunk(
                relative_path,
                language,
                lines,
                symbol_name,
                symbol_kind,
                index + 1,
                end_line,
            )
        )

    return dedupe_chunks(chunks)


def extract_go_chunks(content: str, relative_path: str, language: str) -> List[Dict]:
    lines = content.splitlines()
    chunks: List[Dict] = []

    for index, line in enumerate(lines):
        symbol_name: Optional[str] = None
        symbol_kind: Optional[str] = None

        function_match = GO_FUNCTION_PATTERN.match(line)
        type_match = GO_TYPE_PATTERN.match(line)

        if function_match:
            symbol_name = function_match.group(1)
            symbol_kind = "function"
        elif type_match:
            symbol_name = type_match.group(1)
            symbol_kind = "class"
        else:
            continue

        end_line = find_brace_block_end(lines, index)
        chunks.append(
            make_chunk(
                relative_path,
                language,
                lines,
                symbol_name,
                symbol_kind,
                index + 1,
                end_line,
            )
        )

    return dedupe_chunks(chunks)


def extract_rust_chunks(content: str, relative_path: str, language: str) -> List[Dict]:
    lines = content.splitlines()
    chunks: List[Dict] = []

    for index, line in enumerate(lines):
        symbol_name: Optional[str] = None
        symbol_kind: Optional[str] = None

        for pattern, kind in (
            (RUST_FUNCTION_PATTERN, "function"),
            (RUST_STRUCT_PATTERN, "class"),
            (RUST_IMPL_PATTERN, "class"),
        ):
            match = pattern.match(line)
            if not match:
                continue
            symbol_name = match.group(1)
            symbol_kind = kind
            break

        if not symbol_kind:
            continue

        end_line = find_brace_block_end(lines, index)
        chunks.append(
            make_chunk(
                relative_path,
                language,
                lines,
                symbol_name,
                symbol_kind,
                index + 1,
                end_line,
            )
        )

    return dedupe_chunks(chunks)


def extract_c_like_chunks(content: str, relative_path: str, language: str) -> List[Dict]:
    lines = content.splitlines()
    chunks: List[Dict] = []

    for index, line in enumerate(lines):
        symbol_name: Optional[str] = None
        symbol_kind: Optional[str] = None

        for pattern, kind in (
            (C_LIKE_CLASS_PATTERN, "class"),
            (C_LIKE_FUNCTION_PATTERN, "function"),
        ):
            match = pattern.match(line)
            if not match:
                continue
            symbol_name = match.group(1)
            if symbol_name in RESERVED_KEYWORDS:
                symbol_name = None
                continue
            symbol_kind = kind
            break

        if not symbol_kind or not symbol_name:
            continue

        end_line = find_brace_block_end(lines, index)
        chunks.append(
            make_chunk(
                relative_path,
                language,
                lines,
                symbol_name,
                symbol_kind,
                index + 1,
                end_line,
            )
        )

    return dedupe_chunks(chunks)


def extract_fallback_chunk(content: str, relative_path: str, language: str) -> List[Dict]:
    lines = content.splitlines()
    if not lines:
        return []
    return [
        make_chunk(
            relative_path,
            language,
            lines,
            Path(relative_path).stem,
            "file",
            1,
            len(lines),
        )
    ]


def extract_chunks(relative_path: str, content: str) -> List[Dict]:
    language = get_language(relative_path)
    suffix = Path(relative_path).suffix.lower()

    if suffix == ".py":
        chunks = extract_python_chunks(content, relative_path, language)
    elif suffix in {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"}:
        chunks = extract_javascript_chunks(content, relative_path, language)
    elif suffix == ".go":
        chunks = extract_go_chunks(content, relative_path, language)
    elif suffix == ".rs":
        chunks = extract_rust_chunks(content, relative_path, language)
    elif suffix in {".cpp", ".c", ".h", ".hpp", ".java"}:
        chunks = extract_c_like_chunks(content, relative_path, language)
    else:
        chunks = []

    return chunks or extract_fallback_chunk(content, relative_path, language)


def prepare_lexical_index(chunks: List[Dict]) -> Tuple[Counter, float]:
    if not chunks:
        return Counter(), 0.0

    df_counter: Counter = Counter()
    total_length = 0

    for chunk in chunks:
        total_length += chunk["document_length"]
        for term in chunk["term_freqs"]:
            df_counter[term] += 1

    average_length = total_length / len(chunks)
    return df_counter, average_length


def build_repo_tree(path: Path, base_path: Path) -> List[dict]:
    tree = []

    try:
        items = sorted(path.iterdir(), key=lambda item: (item.is_file(), item.name.lower()))
        for item in items:
            if item.is_dir() and is_ignored_directory(item.name):
                continue
            if item.is_file() and not should_index_file(item):
                continue

            rel_path = item.relative_to(base_path).as_posix()

            if item.is_dir():
                children = build_repo_tree(item, base_path)
                if children:
                    tree.append(
                        {
                            "id": rel_path,
                            "name": item.name,
                            "type": "folder",
                            "children": children,
                        }
                    )
            else:
                tree.append({"id": rel_path, "name": item.name, "type": "file"})
    except Exception as exc:
        print(f"Error building tree for {path}: {exc}")

    return tree


def index_repository(path: Path, *, reason: str = "manual") -> None:
    global indexed_chunks, doc_frequencies, average_document_length, current_repo_path

    path = Path(path)
    update_index_state(
        "indexing",
        message=f"Parsing and indexing {path.name} for AI search...",
        repo_path=path,
        chunk_count=0,
    )

    all_chunks: List[Dict] = []

    try:
        for root, dirs, files in os.walk(path):
            dirs[:] = [directory for directory in dirs if not is_ignored_directory(directory)]
            root_path = Path(root)

            for file_name in files:
                file_path = root_path / file_name
                if not should_index_file(file_path):
                    continue

                relative_path = file_path.relative_to(path).as_posix()

                try:
                    content = file_path.read_text(encoding="utf-8", errors="ignore")
                except Exception as exc:
                    print(f"Error reading {file_path}: {exc}")
                    continue

                for chunk in extract_chunks(relative_path, content):
                    if chunk["content"]:
                        all_chunks.append(chunk)

        doc_frequencies, average_document_length = prepare_lexical_index(all_chunks)
        indexed_chunks = all_chunks
        current_repo_path = path
        update_index_state(
            "ready",
            message=f"Indexed {len(all_chunks)} chunks for AI reranking.",
            repo_path=path,
            chunk_count=len(all_chunks),
        )
    except Exception as exc:
        update_index_state(
            "error",
            message=f"Failed to index repository: {exc}",
            repo_path=path,
        )
        raise

    print(f"Indexed {len(indexed_chunks)} chunks from {path} using local candidate retrieval ({reason})")


def bm25_score(weighted_terms: List[Tuple[str, float]], chunk: Dict) -> float:
    if not indexed_chunks:
        return 0.0

    score = 0.0
    total_docs = max(1, len(indexed_chunks))
    avgdl = average_document_length or 1.0
    k1 = 1.5
    b = 0.75
    doc_length = chunk["document_length"] or 1

    for term, weight in weighted_terms:
        freq = chunk["term_freqs"].get(term, 0)
        if freq <= 0:
            continue

        doc_freq = doc_frequencies.get(term, 0)
        idf = math.log(1 + (total_docs - doc_freq + 0.5) / (doc_freq + 0.5))
        denominator = freq + k1 * (1 - b + b * (doc_length / avgdl))
        score += weight * idf * ((freq * (k1 + 1)) / denominator)

    return score


def fuzzy_score(query: str, chunk: Dict) -> float:
    normalized_query = normalize_identifier(query)
    if not normalized_query:
        return 0.0
    return SequenceMatcher(None, normalized_query, chunk["search_text"]).ratio()


def local_reason(query: str, chunk: Dict) -> str:
    query_terms = {term for term, _ in build_query_terms(query)}
    symbol_overlap = query_terms & chunk["symbol_terms"]
    path_overlap = query_terms & chunk["path_terms"]

    if symbol_overlap:
        return f"Local match from symbol overlap: {', '.join(sorted(symbol_overlap))}."
    if path_overlap:
        return f"Local match from file path overlap: {', '.join(sorted(path_overlap))}."
    return "Closest local code match before AI reranking."


def confidence_from_local_score(score: float, best_score: float) -> float:
    if best_score <= 0:
        return 0.12

    normalized = max(0.0, min(1.0, score / best_score))
    return max(0.12, min(0.72, 0.18 + normalized * 0.54))


def get_local_candidates(query: str, limit: int = LOCAL_CANDIDATE_LIMIT) -> List[Dict]:
    if not indexed_chunks:
        return []

    weighted_terms = build_query_terms(query)
    raw_query_terms = {term for term, _ in weighted_terms}
    ranked = []

    for chunk in indexed_chunks:
        bm25 = bm25_score(weighted_terms, chunk)
        symbol_overlap = len(raw_query_terms & chunk["symbol_terms"])
        path_overlap = len(raw_query_terms & chunk["path_terms"])
        fuzzy = fuzzy_score(query, chunk)
        score = bm25 + (symbol_overlap * 0.45) + (path_overlap * 0.22) + (fuzzy * 0.75)
        if score > 0:
            ranked.append({**chunk, "local_score": score})

    if not ranked:
        fallback = [{**chunk, "local_score": 0.0} for chunk in indexed_chunks[:limit]]
        return fallback

    ranked.sort(key=lambda chunk: chunk["local_score"], reverse=True)
    return ranked[:limit]


def build_candidate_payload(candidates: List[Dict]) -> List[Dict]:
    payload = []
    for chunk in candidates:
        payload.append(
            {
                "filePath": chunk["path"],
                "symbolName": chunk.get("symbol_name") or "",
                "symbolKind": chunk["symbol_kind"],
                "startLine": chunk["start_line"],
                "endLine": chunk["end_line"],
                "language": chunk["language"],
                "preview": chunk["preview"],
                "code": chunk["content"][:MAX_GROQ_CHUNK_CHARS],
                "localScore": round(chunk["local_score"], 4),
            }
        )
    return payload


@dataclass
class GroqRankResult:
    results: List[SearchResult]
    ai_error: Optional[str] = None


def clamp_confidence(value: object) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = 0.0
    return max(0.0, min(1.0, numeric))


def find_candidate_match(ai_item: Dict, candidates: List[Dict]) -> Optional[Dict]:
    file_path = str(ai_item.get("filePath", "")).strip()
    symbol_name = str(ai_item.get("symbolName", "")).strip()
    start_line = coerce_int(ai_item.get("startLine", 0))
    end_line = coerce_int(ai_item.get("endLine", 0))

    exact_matches = [
        chunk
        for chunk in candidates
        if chunk["path"] == file_path
        and chunk["start_line"] == start_line
        and chunk["end_line"] == end_line
        and (chunk.get("symbol_name") or "") == symbol_name
    ]
    if exact_matches:
        return exact_matches[0]

    relaxed_matches = [
        chunk
        for chunk in candidates
        if chunk["path"] == file_path
        and chunk["start_line"] == start_line
        and chunk["end_line"] == end_line
    ]
    if relaxed_matches:
        return relaxed_matches[0]

    if file_path and symbol_name:
        for chunk in candidates:
            if chunk["path"] == file_path and (chunk.get("symbol_name") or "") == symbol_name:
                return chunk

    return None


def parse_groq_json_content(content: object) -> Optional[Dict]:
    if not isinstance(content, str):
        return None

    normalized = content.strip()
    if normalized.startswith("```"):
        normalized = re.sub(r"^```(?:json)?\s*", "", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"\s*```$", "", normalized)

    for candidate in (normalized, normalized[normalized.find("{") : normalized.rfind("}") + 1]):
        if not candidate:
            continue
        try:
            parsed = json.loads(candidate)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if isinstance(parsed, dict):
            return parsed

    return None


async def rerank_with_groq(query: str, groq_api_key: str, candidates: List[Dict]) -> GroqRankResult:
    system_prompt = (
        "You are an AI code search reranker. "
        "Pick only from the provided candidate code chunks. "
        "Return strict JSON only, no markdown, no prose. "
        "Use this exact schema: "
        "{\"results\":[{\"filePath\":\"\",\"symbolName\":\"\",\"startLine\":0,\"endLine\":0,\"confidence\":0,\"reason\":\"\"}]}. "
        "Each result must copy exact filePath, symbolName, startLine, and endLine values from the candidates. "
        "Return at most 8 results ordered best to worst. "
        "Confidence must be a number between 0 and 1. "
        "Reason must be short and concrete."
    )

    user_payload = {
        "query": query,
        "task": "Choose the code chunks that best answer the user's natural-language codebase question.",
        "candidates": build_candidate_payload(candidates),
    }

    request_payload = {
        "model": GROQ_MODEL,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload)},
        ],
    }

    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=GROQ_TIMEOUT_SECONDS) as client:
            response = await client.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers=headers,
                json=request_payload,
            )
    except httpx.TimeoutException:
        return GroqRankResult(results=[], ai_error="Groq timed out. Showing local search results.")
    except httpx.HTTPError:
        return GroqRankResult(results=[], ai_error="Groq request failed. Showing local search results.")

    if response.status_code in {401, 403}:
        return GroqRankResult(
            results=[],
            ai_error="Please add a valid Groq API key to enable AI search. Showing local search results.",
        )
    if response.status_code == 429:
        return GroqRankResult(results=[], ai_error="Groq rate limit reached. Showing local search results.")
    if response.status_code >= 400:
        return GroqRankResult(results=[], ai_error="Groq could not rerank this query. Showing local search results.")

    try:
        payload = response.json()
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError):
        return GroqRankResult(results=[], ai_error="Groq returned an invalid response. Showing local search results.")

    parsed = parse_groq_json_content(content)
    if not parsed:
        return GroqRankResult(results=[], ai_error="Groq returned malformed JSON. Showing local search results.")

    ai_results = parsed.get("results")
    if not isinstance(ai_results, list):
        return GroqRankResult(results=[], ai_error="Groq returned malformed JSON. Showing local search results.")

    reranked_results: List[SearchResult] = []
    seen_ids = set()

    for item in ai_results[:FINAL_RESULT_LIMIT]:
        if not isinstance(item, dict):
            continue

        matched_chunk = find_candidate_match(item, candidates)
        if not matched_chunk or matched_chunk["id"] in seen_ids:
            continue

        seen_ids.add(matched_chunk["id"])
        confidence = clamp_confidence(item.get("confidence"))
        reason = str(item.get("reason", "")).strip() or "AI selected this chunk as a relevant semantic match."
        reranked_results.append(
            SearchResult(
                id=matched_chunk["id"],
                file_name=matched_chunk["file_name"],
                path=matched_chunk["path"],
                symbol_name=matched_chunk.get("symbol_name"),
                symbol_kind=matched_chunk["symbol_kind"],
                start_line=matched_chunk["start_line"],
                end_line=matched_chunk["end_line"],
                score=confidence,
                confidence=confidence,
                local_score=matched_chunk["local_score"],
                explanation=reason,
                preview=matched_chunk["preview"],
                code=matched_chunk["content"],
                language=matched_chunk["language"],
                source="groq",
            )
        )

    if not reranked_results:
        return GroqRankResult(results=[], ai_error="Groq could not confidently map results back to code. Showing local search results.")

    reranked_results.sort(key=lambda result: result.confidence, reverse=True)
    return GroqRankResult(results=reranked_results)


def local_results_from_candidates(query: str, candidates: List[Dict], limit: int = 5) -> List[SearchResult]:
    if not candidates:
        return []

    best_score = max(chunk["local_score"] for chunk in candidates) if candidates else 0.0
    return [
        SearchResult(
            id=chunk["id"],
            file_name=chunk["file_name"],
            path=chunk["path"],
            symbol_name=chunk.get("symbol_name"),
            symbol_kind=chunk["symbol_kind"],
            start_line=chunk["start_line"],
            end_line=chunk["end_line"],
            score=confidence_from_local_score(chunk["local_score"], best_score),
            confidence=confidence_from_local_score(chunk["local_score"], best_score),
            local_score=chunk["local_score"],
            explanation=local_reason(query=query, chunk=chunk),
            preview=chunk["preview"],
            code=chunk["content"],
            language=chunk["language"],
            source="local",
        )
        for chunk in candidates[:limit]
    ]


@app.on_event("startup")
async def startup_event():
    if DEFAULT_FIXTURES_PATH.exists():
        index_repository(DEFAULT_FIXTURES_PATH, reason="startup")


@app.get("/api/health")
@app.get("/health")
async def health():
    return {
        "status": "healthy" if index_state["status"] != "error" else "degraded",
        "indexed_chunks": len(indexed_chunks),
        "repo_path": str(current_repo_path),
        "search_architecture": "local-candidates-plus-groq-rerank",
        "groq_model": GROQ_MODEL,
        "index_status": index_state,
    }


@app.get("/api/tree")
@app.get("/tree")
async def get_tree():
    return build_repo_tree(current_repo_path, current_repo_path)


@app.get("/api/file-content")
@app.get("/file-content")
async def get_file_content(path: str):
    full_path = current_repo_path / path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        content = full_path.read_text(encoding="utf-8", errors="ignore")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "path": path,
        "content": content,
        "language": get_language(path),
    }


@app.post("/api/upload-repo")
@app.post("/upload-repo")
async def upload_repo(file: UploadFile = FastAPIFile(...)):
    global active_temp_dir

    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files allowed")

    cleanup_temp_repo()
    temp_dir = Path(tempfile.mkdtemp())
    zip_path = temp_dir / "repo.zip"

    try:
        with zip_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        extract_path = temp_dir / "extracted"
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(extract_path)

        extracted_items = list(extract_path.iterdir())
        if len(extracted_items) == 1 and extracted_items[0].is_dir():
            final_repo_path = extracted_items[0]
        else:
            final_repo_path = extract_path

        index_repository(final_repo_path, reason="upload")
        active_temp_dir = temp_dir
        return {
            "message": "Repository indexed successfully.",
            "chunk_count": len(indexed_chunks),
        }
    except Exception as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/reset")
@app.get("/reset")
async def reset_repo():
    cleanup_temp_repo()
    index_repository(DEFAULT_FIXTURES_PATH, reason="reset")
    return {"message": "Sample repository reloaded."}


@app.post("/api/search", response_model=SearchResponse)
@app.post("/search", response_model=SearchResponse)
async def search(query: SearchQuery):
    user_query = query.query.strip()
    if not user_query:
        return SearchResponse(results=[], message="Enter a search query.")

    if not indexed_chunks:
        return SearchResponse(results=[], message="No repository indexed.")

    candidates = get_local_candidates(user_query, limit=LOCAL_CANDIDATE_LIMIT)
    if not candidates:
        return SearchResponse(results=[], message="No matching chunks found in the indexed project.")

    local_results = local_results_from_candidates(user_query, candidates, limit=5)
    message = None
    ai_error = None
    used_ai = False
    final_results = local_results

    groq_api_key = (query.groqApiKey or "").strip()
    if not groq_api_key:
        message = "Please add a valid Groq API key to enable AI search. Showing local search results."
    else:
        groq_rerank = await rerank_with_groq(user_query, groq_api_key, candidates)
        if groq_rerank.results:
            final_results = groq_rerank.results
            used_ai = True
        else:
            ai_error = groq_rerank.ai_error
            message = groq_rerank.ai_error or "Groq reranking failed. Showing local search results."

    top_score = final_results[0].score if final_results else 0.0
    if not final_results:
        message = message or "No matching chunks found."

    return SearchResponse(
        results=final_results[:FINAL_RESULT_LIMIT],
        message=message,
        top_score=top_score,
        used_ai=used_ai,
        ai_error=ai_error,
    )


if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    @app.get("/")
    async def serve_frontend_root():
        return FileResponse(FRONTEND_DIST_DIR / "index.html")


    @app.get("/{full_path:path}")
    async def serve_frontend_app(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")

        requested_path = FRONTEND_DIST_DIR / full_path
        if requested_path.is_file():
            return FileResponse(requested_path)

        return FileResponse(FRONTEND_DIST_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
