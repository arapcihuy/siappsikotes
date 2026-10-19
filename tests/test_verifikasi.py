import subprocess, sys

def test_verifikasi():
    result = subprocess.run(["python3", "tools/verifikasi-soal.py"], capture_output=True, text=True)
    assert result.returncode==0, f"FAIL {result.stdout}\n{result.stderr}"
