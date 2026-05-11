import multiprocessing as mp
import os
import sys
from pathlib import Path

import uvicorn


def main() -> None:
    backend_dir = Path(__file__).resolve().parent
    is_managed_runtime = bool(os.getenv("PORT"))
    host = os.getenv("HOST") or os.getenv("REPO_BACKEND_HOST") or ("0.0.0.0" if is_managed_runtime else "127.0.0.1")
    port = int(os.getenv("PORT") or os.getenv("REPO_BACKEND_PORT", "8000"))
    default_reload = "false" if is_managed_runtime else "true"
    reload_enabled = os.getenv("REPO_BACKEND_RELOAD", default_reload).lower() not in {"0", "false", "no"}

    # On some macOS Python setups, uvicorn's reloader can spawn a worker using a
    # different interpreter than the one that has our dependencies installed.
    mp.set_executable(sys.executable)

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload_enabled,
        reload_dirs=[str(backend_dir)],
    )


if __name__ == "__main__":
    main()
