from __future__ import annotations

import collections
import hashlib
import os
import re
import struct
import subprocess
import time
import zipfile
from pathlib import Path

from capstone import CS_ARCH_X86, CS_MODE_32, Cs
from elftools.elf.elffile import ELFFile
from unicorn import UC_ARCH_X86, UC_HOOK_CODE, UC_MODE_32, UC_PROT_ALL, Uc, UcError
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EDX, UC_X86_REG_EIP, UC_X86_REG_ESP


APK_PATH = Path("/Users/yang/Downloads/sjxnphb_1034221.apk")
SO_PATH = Path("/tmp/socmark_apk/lib/x86/libbattery.so")
CERT_PEM = Path("/tmp/socmark_cert.pem")
CERT_DER = Path("/tmp/socmark_cert.der")

STACK = 0x10000000
STACK_SIZE = 0x200000
HEAP = 0x20000000
ENV_PTR = 0x70000000
TABLE = 0x70001000
STUB_BASE = 0x71000000
RET = 0x7FFF0000


def u32(value: int) -> bytes:
    return struct.pack("<I", value & 0xFFFFFFFF)


def r32(mu: Uc, addr: int) -> int:
    return struct.unpack("<I", mu.mem_read(addr, 4))[0]


def w32(mu: Uc, addr: int, value: int) -> None:
    mu.mem_write(addr, u32(value))


class BatteryEmu:
    def __init__(self, verbose: bool = False) -> None:
        self.verbose = verbose
        self.heap = HEAP
        self.next_obj = 0x73000000
        self.objects: dict[int, dict[str, object]] = {}
        self.strings: dict[int, str] = {}
        self.byte_arrays: dict[int, bytes] = {}
        self.arrays: dict[int, list[int]] = {}
        self.trace: collections.deque[object] = collections.deque(maxlen=160)
        self.result: str | None = None
        self.mu: Uc | None = None
        self.stub_names: dict[int, str] = {}
        self.jni_by_addr: dict[int, int] = {}

    def new_obj(self, kind: str, **kwargs: object) -> int:
        handle = self.next_obj
        self.next_obj += 0x10
        self.objects[handle] = {"kind": kind, **kwargs}
        return handle

    def new_str(self, value: str) -> int:
        handle = self.new_obj("string")
        self.strings[handle] = value
        return handle

    def new_method(self, cls: int, name: str, sig: str, static: bool) -> int:
        return self.new_obj("method", cls=cls, name=name, sig=sig, static=static)

    def new_field(self, cls: int, name: str, sig: str, static: bool) -> int:
        return self.new_obj("field", cls=cls, name=name, sig=sig, static=static)

    def new_bytes(self, value: bytes) -> int:
        handle = self.new_obj("bytes")
        self.byte_arrays[handle] = bytes(value)
        return handle

    def new_array(self, values: list[int]) -> int:
        handle = self.new_obj("array")
        self.arrays[handle] = list(values)
        return handle

    def cstr(self, addr: int, limit: int = 8192) -> str:
        if not addr or self.mu is None:
            return ""
        out = bytearray()
        try:
            for index in range(limit):
                byte = self.mu.mem_read(addr + index, 1)[0]
                if byte == 0:
                    break
                out.append(byte)
        except Exception:
            pass
        return out.decode("utf-8", "replace")

    def write_bytes(self, value: bytes) -> int:
        assert self.mu is not None
        ptr = self.heap
        self.heap = (ptr + len(value) + 15) & ~15
        self.mu.mem_write(ptr, value)
        return ptr

    def write_cstr(self, value: str) -> int:
        return self.write_bytes(value.encode("utf-8") + b"\0")

    def read_jstr(self, handle: int) -> str:
        return self.strings.get(handle, f"<{handle:x}>")

    def decoded_data(self, elf: ELFFile) -> tuple[int, bytes]:
        text = elf.get_section_by_name(".text")
        data_sec = elf.get_section_by_name(".data")
        blob = bytearray(data_sec.data())
        code = text.data()[0x1A8D0 - text["sh_addr"] : 0x1A8D0 - text["sh_addr"] + 0x1D52]
        instructions = list(Cs(CS_ARCH_X86, CS_MODE_32).disasm(code, 0x1A8D0))
        base = 0x5ADF8
        for index, ins in enumerate(instructions):
            match = re.search(r"byte ptr \[ecx \+ eax \+ (0x[0-9a-f]+)\]", ins.op_str)
            if ins.mnemonic != "mov" or not match:
                continue
            key = None
            limit = None
            for next_ins in instructions[index + 1 : index + 20]:
                if next_ins.mnemonic == "xor" and next_ins.op_str.startswith("dl,"):
                    key = int(next_ins.op_str.split(",")[1].strip(), 0)
                if next_ins.mnemonic == "sub" and next_ins.op_str.startswith("eax,"):
                    limit = int(next_ins.op_str.split(",")[1].strip(), 0)
                    break
            if key is None or limit is None:
                continue
            start = base + int(match.group(1), 16) - data_sec["sh_addr"]
            length = limit + 1
            if 0 <= start and start + length <= len(blob):
                for offset in range(length):
                    blob[start + offset] ^= key
        return data_sec["sh_addr"], bytes(blob)

    def setup(self) -> None:
        self.mu = Uc(UC_ARCH_X86, UC_MODE_32)
        mu = self.mu
        elf = ELFFile(SO_PATH.open("rb"))

        mu.mem_map(0, 0x1000)
        mu.mem_write(0x14, u32(0x12345678))
        mu.mem_map(0x1000, 0x700000 - 0x1000, UC_PROT_ALL)
        for segment in elf.iter_segments():
            if segment["p_type"] != "PT_LOAD":
                continue
            va = segment["p_vaddr"]
            data = segment.data()
            mu.mem_write(va, data)
            if segment["p_memsz"] > len(data):
                mu.mem_write(va + len(data), b"\0" * (segment["p_memsz"] - len(data)))

        data_addr, data_blob = self.decoded_data(elf)
        mu.mem_write(data_addr, data_blob)

        mu.mem_map(STUB_BASE, 0x20000, UC_PROT_ALL)
        mu.mem_write(STUB_BASE, b"\xCC" * 0x20000)
        stub_next = STUB_BASE - 4

        def stub_for(name: str) -> int:
            nonlocal stub_next
            stub_next += 4
            self.stub_names[stub_next] = name
            return stub_next

        for section_name in [".rel.dyn", ".rel.plt"]:
            section = elf.get_section_by_name(section_name)
            if section is None:
                continue
            symtab = elf.get_section(section["sh_link"])
            for rel in section.iter_relocations():
                offset = rel["r_offset"]
                rel_type = rel["r_info_type"]
                sym = symtab.get_symbol(rel["r_info_sym"]) if rel["r_info_sym"] else None
                name = sym.name if sym else ""
                value = sym["st_value"] if sym else 0
                if rel_type == 1:
                    w32(mu, offset, (r32(mu, offset) + value) & 0xFFFFFFFF)
                elif rel_type in (6, 7):
                    external = name in {
                        "_Znaj",
                        "_Znwj",
                        "_ZdaPv",
                        "_ZdlPv",
                        "malloc",
                        "free",
                        "memset",
                        "strlen",
                        "strcpy",
                        "strcat",
                        "strcmp",
                        "memcmp",
                        "sprintf",
                        "fopen",
                        "fseek",
                        "ftell",
                        "fclose",
                        "abort",
                        "__stack_chk_fail",
                    }
                    w32(mu, offset, stub_for(name) if external or not value else value)

        mu.mem_map(STACK, STACK_SIZE, UC_PROT_ALL)
        mu.mem_map(HEAP, 0x1000000, UC_PROT_ALL)
        mu.mem_map(ENV_PTR, 0x50000, UC_PROT_ALL)
        w32(mu, ENV_PTR, TABLE)
        for index in range(340):
            addr = STUB_BASE + 0x10000 + index * 4
            w32(mu, TABLE + index * 4, addr)
            self.jni_by_addr[addr] = index
        mu.mem_write(STUB_BASE + 0x10000, b"\xCC" * (340 * 4 + 4))
        mu.mem_map(RET, 0x1000, UC_PROT_ALL)
        mu.mem_write(RET, b"\xCC")

        if not CERT_DER.exists() and CERT_PEM.exists():
            subprocess.run(
                f"openssl x509 -in {CERT_PEM} -outform DER -out {CERT_DER}",
                shell=True,
                check=False,
            )

    def ret(self, eax: int = 0, edx: int | None = None) -> None:
        assert self.mu is not None
        esp = self.mu.reg_read(UC_X86_REG_ESP)
        ra = r32(self.mu, esp)
        self.mu.reg_write(UC_X86_REG_EAX, eax & 0xFFFFFFFF)
        if edx is not None:
            self.mu.reg_write(UC_X86_REG_EDX, edx & 0xFFFFFFFF)
        self.mu.reg_write(UC_X86_REG_ESP, esp + 4)
        self.mu.reg_write(UC_X86_REG_EIP, ra)

    def call_static(self, method: dict[str, object], args: list[int]) -> int:
        cls = self.objects.get(int(method.get("cls", 0)), {}).get("name", "")
        name = str(method.get("name", ""))
        self.trace.append(("static", cls, name, [self.read_jstr(x) if x in self.strings else hex(x) for x in args[:3]]))
        if cls == "android/app/ActivityThread" and name in {"currentActivityThread", "currentApplication"}:
            return self.new_obj("application")
        if cls == "java/lang/System" and name == "currentTimeMillis":
            return int(time.time() * 1000)
        if name == "get" and len(args) >= 2:
            return args[1]
        if name == "getIM":
            return int(time.time() * 1000)
        if name == "getStr":
            key = self.read_jstr(args[0]) if args else ""
            if key == "cae":
                return self.new_str("KhBJ3k7xHB20phvV8OcUlA==")
            return args[1] if len(args) > 1 else self.new_str("")
        if cls == "java/security/MessageDigest" and name == "getInstance":
            return self.new_obj("md", alg=self.read_jstr(args[0]).lower(), data=b"")
        return 0

    def call_inst(self, obj: int, method: dict[str, object], args: list[int]) -> int:
        name = str(method.get("name", ""))
        kind = self.objects.get(obj, {}).get("kind")
        self.trace.append(("inst", kind, name, [self.read_jstr(x) if x in self.strings else hex(x) for x in args[:3]]))
        if kind == "application" and name == "getPackageCodePath":
            return self.new_str(str(APK_PATH))
        if kind == "application" and name == "getPackageManager":
            return self.new_obj("pm")
        if kind == "application" and name == "getPackageName":
            return self.new_str("com.nasoft.socmark")
        if kind == "pm" and name == "getPackageInfo":
            return self.new_obj("pkginfo")
        if kind == "signature" and name == "toByteArray":
            return self.new_bytes(CERT_DER.read_bytes() if CERT_DER.exists() else b"")
        if kind == "md":
            if name == "update":
                if args and args[0] in self.byte_arrays:
                    self.objects[obj]["data"] = bytes(self.objects[obj].get("data", b"")) + self.byte_arrays[args[0]]
                return 0
            if name == "digest":
                return self.new_bytes(hashlib.md5(bytes(self.objects[obj].get("data", b""))).digest())
        return 0

    def hook(self, mu: Uc, addr: int, _size: int, _user: object) -> None:
        if addr == RET:
            eax = mu.reg_read(UC_X86_REG_EAX)
            self.result = self.strings.get(eax)
            print("RETURN", hex(eax), self.result)
            mu.emu_stop()
            return

        if addr in self.stub_names:
            name = self.stub_names[addr]
            esp = mu.reg_read(UC_X86_REG_ESP)
            self.trace.append(("ext", name))
            if name in {"abort", "__stack_chk_fail"}:
                print("STOP", name, "eip", hex(mu.reg_read(UC_X86_REG_EIP)))
                for item in self.trace:
                    print(item)
                mu.emu_stop()
                return
            if name in {"malloc", "_Znaj", "_Znwj", "realloc"}:
                size = r32(mu, esp + 4)
                ptr = self.heap
                self.heap = (ptr + max(size, 1) + 15) & ~15
                if self.verbose:
                    print("malloc", size, "->", hex(ptr))
                self.ret(ptr)
                return
            if name in {"free", "_ZdaPv", "_ZdlPv", "__cxa_atexit", "__cxa_finalize", "pthread_mutex_lock", "pthread_mutex_unlock"}:
                self.ret(0)
                return
            if name == "pthread_getspecific":
                self.ret(0)
                return
            if name in {"pthread_once", "pthread_key_create", "pthread_key_delete", "pthread_setspecific"}:
                self.ret(0)
                return
            if name == "memset":
                dst = r32(mu, esp + 4)
                value = r32(mu, esp + 8) & 0xFF
                size = min(r32(mu, esp + 12), 0x100000)
                mu.mem_write(dst, bytes([value]) * size)
                self.ret(dst)
                return
            if name == "strlen":
                self.ret(len(self.cstr(r32(mu, esp + 4))))
                return
            if name == "strcpy":
                dst = r32(mu, esp + 4)
                src = self.cstr(r32(mu, esp + 8)).encode() + b"\0"
                mu.mem_write(dst, src)
                self.ret(dst)
                return
            if name == "strcat":
                dst = r32(mu, esp + 4)
                current = self.cstr(dst).encode()
                src = self.cstr(r32(mu, esp + 8)).encode() + b"\0"
                mu.mem_write(dst + len(current), src)
                self.ret(dst)
                return
            if name == "strcmp":
                left = self.cstr(r32(mu, esp + 4))
                right = self.cstr(r32(mu, esp + 8))
                self.trace.append(("strcmp", left, right))
                self.ret(0 if left == right else 1)
                return
            if name == "memcmp":
                size = r32(mu, esp + 12)
                self.ret(0 if mu.mem_read(r32(mu, esp + 4), size) == mu.mem_read(r32(mu, esp + 8), size) else 1)
                return
            if name == "fopen":
                self.ret(self.new_obj("file", path=self.cstr(r32(mu, esp + 4))))
                return
            if name == "ftell":
                self.ret(zipfile.ZipFile(APK_PATH).getinfo("classes.dex").file_size)
                return
            if name in {"fseek", "fclose", "fwrite", "fputs", "fputc", "write", "sprintf", "dl_iterate_phdr", "opendir", "readdir", "closedir"}:
                self.ret(0)
                return
            self.ret(0)
            return

        if addr not in self.jni_by_addr:
            return

        idx = self.jni_by_addr[addr]
        esp = mu.reg_read(UC_X86_REG_ESP)
        raw = []
        for offset in range(8):
            try:
                raw.append(r32(mu, esp + 4 + offset * 4))
            except Exception:
                raw.append(0)

        if idx == 6:
            self.ret(self.new_obj("class", name=self.cstr(raw[1])))
        elif idx == 113:
            self.ret(self.new_method(raw[1], self.cstr(raw[2]), self.cstr(raw[3]), True))
        elif idx == 33:
            self.ret(self.new_method(raw[1], self.cstr(raw[2]), self.cstr(raw[3]), False))
        elif idx == 144:
            self.ret(self.new_field(raw[1], self.cstr(raw[2]), self.cstr(raw[3]), True))
        elif idx == 94:
            self.ret(self.new_field(raw[1], self.cstr(raw[2]), self.cstr(raw[3]), False))
        elif idx == 145:
            self.ret(self.new_obj("pm_proxy"))
        elif idx == 31:
            self.ret(self.new_obj("class", name=str(self.objects.get(raw[1], {}).get("kind", "object"))))
        elif idx in {10, 11, 23, 170}:
            self.ret(0)
        elif idx in {115, 116, 114, 118, 133, 132, 131}:
            method = self.objects.get(raw[2], {})
            args = []
            for offset in range(4):
                try:
                    args.append(r32(mu, raw[3] + offset * 4))
                except Exception:
                    pass
            answer = self.call_static(method, args)
            if idx in {131, 132, 133}:
                self.ret(answer & 0xFFFFFFFF, answer >> 32)
            else:
                self.ret(answer if isinstance(answer, int) else 0)
        elif idx in {35, 36, 34, 62}:
            method = self.objects.get(raw[2], {})
            args = []
            for offset in range(4):
                try:
                    args.append(r32(mu, raw[3] + offset * 4))
                except Exception:
                    pass
            self.ret(self.call_inst(raw[1], method, args))
        elif idx == 95:
            field = self.objects.get(raw[2], {})
            obj = raw[1]
            if self.objects.get(obj, {}).get("kind") == "pkginfo" and field.get("name") == "signatures":
                self.ret(self.new_array([self.new_obj("signature")]))
            else:
                self.ret(0)
        elif idx == 167:
            self.ret(self.new_str(self.cstr(raw[1])))
        elif idx == 169:
            self.ret(self.write_cstr(self.read_jstr(raw[1])))
        elif idx == 171:
            self.ret(len(self.arrays.get(raw[1], [])) if raw[1] in self.arrays else len(self.byte_arrays.get(raw[1], b"")))
        elif idx == 173:
            self.ret(self.arrays.get(raw[1], [0])[raw[2]] if raw[1] in self.arrays else 0)
        elif idx == 184:
            self.ret(self.write_bytes(self.byte_arrays.get(raw[1], b"")))
        else:
            self.trace.append(("jni?", idx, [hex(x) for x in raw[:5]]))
            self.ret(0)

    def run(self, arg1: int, arg2: int, arg3: int, count: int = 3_000_000) -> str | None:
        self.setup()
        assert self.mu is not None
        self.mu.hook_add(UC_HOOK_CODE, self.hook)
        esp = STACK + STACK_SIZE - 0x1000
        for index, value in enumerate([RET, ENV_PTR, 0x70002000, arg1, arg2, arg3 & 0xFFFFFFFF, arg3 >> 32]):
            w32(self.mu, esp + index * 4, value)
        self.mu.reg_write(UC_X86_REG_ESP, esp)
        try:
            self.mu.emu_start(0x30080, RET, timeout=20_000_000, count=count)
        except UcError as err:
            print("UCERR", err, "eip", hex(self.mu.reg_read(UC_X86_REG_EIP)))
            for item in self.trace:
                print(item)
        return self.result


if __name__ == "__main__":
    for args in [(66, 10, 52509215), (37, 68, 52923923), (9230, 5232, 19191)]:
        print("ARGS", args)
        print(BatteryEmu(verbose=True).run(*args))
