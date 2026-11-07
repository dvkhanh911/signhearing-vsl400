"""Include the shared learning renderer in the independently built backend service."""

import shutil
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
REPOSITORY = BACKEND.parent
FILES = (
    "app_modules.py",
    "content.py",
    "i18n.py",
    "serve.py",
    "site-config.json",
    "index.html",
    "login.html",
    "under-construction.html",
    "404.html",
    "data/curriculum.json",
)
DIRECTORIES = ("app_shell", "modules", "partials", "locales", "static")


def prepare(repository: Path = REPOSITORY, backend: Path = BACKEND) -> Path:
    repository = repository.resolve()
    backend = backend.resolve()
    destination = backend / "legacy_site"
    # Only replace the generated bundle directly inside the backend directory.
    if destination.is_symlink() or destination.is_junction():
        raise ValueError("The generated legacy_site directory must not be a link")
    if destination.resolve().parent != backend or destination.name != "legacy_site":
        raise ValueError("The generated bundle must remain inside the backend directory")
    for name in (*FILES, *DIRECTORIES):
        if not (repository / name).exists():
            raise FileNotFoundError(f"Required learning source is missing: {name}")
    backend.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir()
    for name in FILES:
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(repository / name, target)
    for name in DIRECTORIES:
        shutil.copytree(
            repository / name,
            destination / name,
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "tests", "tools", "README.md"),
        )
    return destination


if __name__ == "__main__":
    bundle = prepare()
    size = sum(path.stat().st_size for path in bundle.rglob("*") if path.is_file())
    print(f"Prepared learning renderer, translations and media: {size / 1_000_000:.2f} MB")
