#!/usr/bin/env python3
"""
Verify TANGO binary path resolution.
Resolves and prints the exact tango binary used by each path (simple, host, docker).
"""

import os
import sys
import shutil
from pathlib import Path

# Add backend to path
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# Import tango module
import tango

def resolve_simple_path():
    """Resolve path used by simple runner."""
    tango_dir = tango.TANGO_DIR
    bin_path = os.path.join(tango_dir, "bin", "tango")
    bin_path_abs = os.path.abspath(bin_path)
    
    # Check TANGO_BIN env var
    tango_bin_env = os.getenv("TANGO_BIN")
    if tango_bin_env and os.path.exists(tango_bin_env):
        return os.path.abspath(tango_bin_env)
    
    # Check default location
    if os.path.exists(bin_path):
        return bin_path_abs
    
    # Fallback to system PATH
    which_path = shutil.which("tango")
    if which_path:
        return os.path.abspath(which_path)
    
    return None

def resolve_host_path():
    """Resolve path used by host runner."""
    # Host runner uses TANGO_BIN env var or _resolve_tango_bin()
    try:
        return tango._resolve_tango_bin()
    except RuntimeError:
        return None

def resolve_docker_path():
    """Resolve path used by Docker runner."""
    # Docker runner uses volume mount: TANGO_DIR -> /app/Tango
    tango_dir = tango.TANGO_DIR
    tango_dir_abs = os.path.abspath(tango_dir)
    return f"docker:{os.getenv('TANGO_DOCKER_IMAGE', 'desy-tango')} (volume: {tango_dir_abs}:/app/Tango)"

def check_path(path, name):
    """Check if path exists and is executable."""
    if path is None:
        return False, False, "Not found"
    
    if path.startswith("docker:"):
        return True, True, "Docker image (check separately)"
    
    exists = os.path.exists(path)
    executable = os.access(path, os.X_OK) if exists else False
    
    # Check macOS quarantine
    quarantined = False
    if exists and sys.platform == "darwin":
        try:
            import subprocess
            result = subprocess.run(
                ["xattr", "-l", path],
                capture_output=True,
                text=True,
                timeout=1
            )
            if "com.apple.quarantine" in result.stdout:
                quarantined = True
        except Exception:
            pass
    
    status = []
    if not exists:
        status.append("missing")
    if exists and not executable:
        status.append("not executable")
    if quarantined:
        status.append("quarantined")
    if exists and executable and not quarantined:
        status.append("OK")
    
    return exists, executable, ", ".join(status) if status else "OK"

def main():
    print("🔍 Verifying TANGO binary paths...")
    print("")
    
    # Simple runner
    print("Simple Runner:")
    simple_path = resolve_simple_path()
    simple_exists, simple_exec, simple_status = check_path(simple_path, "simple")
    print(f"  Path: {simple_path or 'NOT FOUND'}")
    print(f"  Status: {simple_status}")
    if simple_path and simple_exists:
        print(f"  Absolute: {os.path.abspath(simple_path)}")
    print("")
    
    # Host runner
    print("Host Runner:")
    try:
        host_path = resolve_host_path()
        host_exists, host_exec, host_status = check_path(host_path, "host")
        print(f"  Path: {host_path or 'NOT FOUND'}")
        print(f"  Status: {host_status}")
        if host_path and host_exists and not host_path.startswith("docker:"):
            print(f"  Absolute: {os.path.abspath(host_path)}")
    except RuntimeError as e:
        print(f"  Path: NOT FOUND")
        print(f"  Status: {str(e)}")
    print("")
    
    # Docker runner
    print("Docker Runner:")
    docker_path = resolve_docker_path()
    docker_exists, docker_exec, docker_status = check_path(docker_path, "docker")
    print(f"  Path: {docker_path}")
    print(f"  Status: {docker_status}")
    print("")
    
    # Summary
    print("Summary:")
    if simple_path and simple_exists and simple_exec:
        print("  ✅ Simple runner: OK")
    else:
        print("  ❌ Simple runner: FAILED")
    
    try:
        host_path = resolve_host_path()
        if host_path and host_exists and host_exec:
            print("  ✅ Host runner: OK")
        else:
            print("  ❌ Host runner: FAILED")
    except RuntimeError:
        print("  ❌ Host runner: FAILED")
    
    if docker_exists:
        print("  ✅ Docker runner: Available (check image separately)")
    else:
        print("  ⚠️  Docker runner: Not available")
    
    # Exit code
    if simple_path and simple_exists and simple_exec:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()

