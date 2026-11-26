"""Run the Chinese setup wizard in a real terminal for release verification."""

import errno
import fcntl
import os
import pty
import re
import select
import signal
import struct
import subprocess
import sys
import termios
import time


def drive(command, choose_assistant=False):
    output, tty = pty.openpty()
    fcntl.ioctl(tty, termios.TIOCSWINSZ, struct.pack("HHHH", 30, 120, 0, 0))
    env = {**os.environ, "TERM": "xterm-256color", "NO_COLOR": "1", "FORCE_COLOR": "0"}
    try:
        process = subprocess.Popen(command, stdin=tty, stdout=tty, stderr=tty, env=env, start_new_session=True)
    finally:
        os.close(tty)

    transcript = bytearray()
    offset = 0

    def wait_for(label, timeout=15):
        nonlocal offset
        token = label.encode()
        deadline = None if timeout is None else time.monotonic() + timeout
        while (position := transcript.find(token, offset)) < 0:
            remaining = None if deadline is None else max(0, deadline - time.monotonic())
            if not select.select([output], [], [], remaining)[0]:
                raise RuntimeError(f"Timed out waiting for {label}")
            try:
                chunk = os.read(output, 65536)
            except OSError as error:
                if error.errno != errno.EIO:
                    raise
                chunk = b""
            if not chunk:
                raise RuntimeError(f"CLI exited before {label}")
            transcript.extend(chunk)
        offset = position + len(token)

    def answer(prompt, choices=(), timeout=15):
        wait_for(prompt, timeout)
        wait_for("└")
        for label in choices:
            os.write(output, b"\x1b[B")
            wait_for("● " + label)
        os.write(output, b"\r")

    try:
        answer("项目目录", timeout=180)
        answer("模板")
        answer("文档风格", choices=("编辑", "终端", "瑞士风格"))
        if not any(arg == "--layout" or arg.startswith("--layout=") for arg in command):
            answer("导航布局")
        answer("文档语言", choices=("English + 简体中文",))
        if "--assistant" not in command:
            answer("启用 AI 助手？", choices=("是",) if choose_assistant else ())
        answer("包管理器")
        if "--no-install" not in command:
            answer("现在安装依赖？")
        # Keep draining the terminal while npm installs. A CLI failure closes the PTY.
        wait_for("进入项目目录后运行", timeout=None)
        if process.wait(timeout=15):
            raise RuntimeError(f"CLI exited with code {process.returncode}")
    except Exception:
        recent = transcript[-8000:].decode(errors="replace")
        print(re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", recent), file=sys.stderr)
        raise
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
        os.close(output)


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["--choose-assistant"]:
        drive(args[1:], choose_assistant=True)
    else:
        drive(args)
