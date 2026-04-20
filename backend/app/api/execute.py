"""
Code execution endpoint — supports C, C++, C#, Java, Python, JS, Ruby, Go, Rust, SQL.
HTML/CSS returns a special "preview" response (no server execution needed).
"""

import asyncio
import os
import re
import tempfile
import uuid
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/execute", tags=["execute"])

TIMEOUT = 10
EXEC_PATH = "/usr/local/go/bin:/usr/local/bin:/usr/bin:/bin"
BASE_ENV = {"PATH": EXEC_PATH, "HOME": "/tmp", "GOPATH": "/tmp/gopath",
            "PYTHONDONTWRITEBYTECODE": "1"}


class RunRequest(BaseModel):
    code: str
    language: str


class RunResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool
    is_web_preview: bool = False


@router.post("", response_model=RunResponse)
async def execute_code(body: RunRequest):
    lang = body.language.lower()

    if lang in ("html", "css"):
        return RunResponse(stdout="", stderr="", exit_code=0, timed_out=False, is_web_preview=True)

    handlers = {
        "python":     _run_python,
        "javascript": _run_javascript,
        "typescript": _run_typescript,
        "go":         _run_go,
        "rust":       _run_rust,
        "c":          _run_c,
        "cpp":        _run_cpp,
        "java":       _run_java,
        "ruby":       _run_ruby,
        "sql":        _run_sql,
        "csharp":     _run_csharp,
    }

    handler = handlers.get(lang)
    if not handler:
        return RunResponse(stdout="", stderr=f"Execution not supported for: {lang}",
                           exit_code=1, timed_out=False)
    return await handler(body.code)


# ── language runners ─────────────────────────────────────────────────────────

async def _run_python(code: str) -> RunResponse:
    return await _run_in_file(["python3", "-u"], ".py", code)


async def _run_javascript(code: str) -> RunResponse:
    return await _run_in_file(["node"], ".js", code)


async def _run_typescript(code: str) -> RunResponse:
    return await _run_in_file(["npx", "--yes", "ts-node", "--skip-project"], ".ts", code)


async def _run_go(code: str) -> RunResponse:
    return await _run_in_file(["go", "run"], ".go", code)


async def _run_ruby(code: str) -> RunResponse:
    return await _run_in_file(["ruby"], ".rb", code)


async def _run_sql(code: str) -> RunResponse:
    return await _run_in_file(["sqlite3", ":memory:"], ".sql", code,
                               extra_args_before_file=False, stdin_input=code,
                               cmd_override=["sqlite3", ":memory:"])


async def _run_rust(code: str) -> RunResponse:
    tmp = f"/tmp/rust_{uuid.uuid4().hex}"
    src = tmp + ".rs"
    out = tmp + "_out"
    with open(src, "w") as f:
        f.write(code)
    try:
        compile_result = await _exec(["rustc", src, "-o", out])
        if compile_result.exit_code != 0:
            return compile_result
        return await _exec([out])
    finally:
        for p in [src, out]:
            try: os.unlink(p)
            except FileNotFoundError: pass


async def _run_c(code: str) -> RunResponse:
    return await _compile_and_run(code, ".c", ["gcc", "-o", "{out}", "{src}", "-lm"])


async def _run_cpp(code: str) -> RunResponse:
    return await _compile_and_run(code, ".cpp", ["g++", "-o", "{out}", "{src}", "-lm"])


async def _run_java(code: str) -> RunResponse:
    # Java requires filename == public class name
    match = re.search(r"public\s+class\s+(\w+)", code)
    class_name = match.group(1) if match else "Main"
    tmp_dir = f"/tmp/java_{uuid.uuid4().hex}"
    os.makedirs(tmp_dir, exist_ok=True)
    src = os.path.join(tmp_dir, f"{class_name}.java")
    with open(src, "w") as f:
        f.write(code)
    try:
        compile_result = await _exec(["javac", src], cwd=tmp_dir)
        if compile_result.exit_code != 0:
            return compile_result
        return await _exec(["java", "-cp", tmp_dir, class_name], cwd=tmp_dir)
    finally:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def _run_csharp(code: str) -> RunResponse:
    tmp = f"/tmp/cs_{uuid.uuid4().hex}"
    src = tmp + ".cs"
    out = tmp + ".exe"
    with open(src, "w") as f:
        f.write(code)
    try:
        compile_result = await _exec(["mcs", "-out:" + out, src])
        if compile_result.exit_code != 0:
            return compile_result
        return await _exec(["mono", out])
    finally:
        for p in [src, out]:
            try: os.unlink(p)
            except FileNotFoundError: pass


# ── helpers ──────────────────────────────────────────────────────────────────

async def _compile_and_run(code: str, ext: str, compile_cmd_template: list[str]) -> RunResponse:
    tmp = f"/tmp/prog_{uuid.uuid4().hex}"
    src = tmp + ext
    out = tmp + "_out"
    with open(src, "w") as f:
        f.write(code)
    cmd = [p.replace("{src}", src).replace("{out}", out) for p in compile_cmd_template]
    try:
        compile_result = await _exec(cmd)
        if compile_result.exit_code != 0:
            return compile_result
        return await _exec([out])
    finally:
        for p in [src, out]:
            try: os.unlink(p)
            except FileNotFoundError: pass


async def _run_in_file(cmd: list[str], ext: str, code: str, **_) -> RunResponse:
    with tempfile.NamedTemporaryFile(mode="w", suffix=ext, delete=False) as f:
        f.write(code)
        path = f.name
    try:
        return await _exec(cmd + [path])
    finally:
        try: os.unlink(path)
        except FileNotFoundError: pass


async def _exec(cmd: list[str], stdin: bytes | None = None, cwd: str | None = None) -> RunResponse:
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdin=asyncio.subprocess.PIPE if stdin else None,
            env=BASE_ENV,
            cwd=cwd,
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(stdin), timeout=TIMEOUT)
            return RunResponse(
                stdout=stdout_b.decode("utf-8", errors="replace"),
                stderr=stderr_b.decode("utf-8", errors="replace"),
                exit_code=proc.returncode or 0,
                timed_out=False,
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return RunResponse(stdout="", stderr=f"Timed out after {TIMEOUT}s",
                               exit_code=124, timed_out=True)
    except FileNotFoundError:
        return RunResponse(stdout="", stderr=f"Runtime not installed: {cmd[0]}",
                           exit_code=127, timed_out=False)
    except Exception as e:
        return RunResponse(stdout="", stderr=str(e), exit_code=1, timed_out=False)
