"""Local Tuya v3.5 provider for the Home Dashboard home bridge.

Communicates directly with Tuya devices over LAN TCP port 6668 using the
protocol 3.5 (0x00006699) AES-GCM frame format and 3-way session key
negotiation, requiring no Home Assistant or runtime Tuya Cloud connection.
"""
from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import logging
import os
import re
import socket
import struct
import threading
import time
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

log = logging.getLogger(__name__)

TUYA_PORT = 6668
MAGIC_PREFIX = 0x00006699
MAGIC_SUFFIX = 0x00009966
CMD_SESS_KEY_NEG_START = 0x03
CMD_SESS_KEY_NEG_RESP = 0x04
CMD_SESS_KEY_NEG_FINISH = 0x05
CMD_STATUS = 0x08
CMD_CONTROL_NEW = 0x0D
CMD_DP_QUERY_NEW = 0x10
HEADER_6699 = struct.Struct(">IHIII")
SUFFIX_6699 = struct.Struct(">I")
VERSION_HEADER_35 = b"3.5" + b"\x00" * 12


class TuyaError(RuntimeError):
    """Base error for a local Tuya device operation."""


class TuyaUnavailable(TuyaError):
    """The configured Tuya device did not answer on the LAN."""


def _safe_id(value: str) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", value.lower()).strip("_")[:60]


def _pack_6699(seq: int, cmd: int, payload: bytes, key: bytes) -> bytes:
    """Encode and AES-GCM encrypt a Tuya v3.5 (0x00006699) frame."""
    iv = os.urandom(12)
    length = 12 + len(payload) + 16
    aad = struct.pack(">HIII", 0, seq, cmd, length)
    ct_tag = AESGCM(key).encrypt(iv, payload, aad)
    return struct.pack(">I", MAGIC_PREFIX) + aad + iv + ct_tag + SUFFIX_6699.pack(MAGIC_SUFFIX)


def _unpack_6699(frame: bytes, key: bytes) -> tuple[int, int, bytes]:
    """Verify framing and decrypt a Tuya v3.5 (0x00006699) frame."""
    if len(frame) < 50:
        raise TuyaError("Truncated Tuya v3.5 frame")
    magic, _ver, seq, cmd, length = HEADER_6699.unpack_from(frame, 0)
    if magic != MAGIC_PREFIX or len(frame) != 18 + length + 4:
        raise TuyaError("Invalid Tuya v3.5 frame header or length")
    if SUFFIX_6699.unpack_from(frame, 18 + length)[0] != MAGIC_SUFFIX:
        raise TuyaError("Invalid Tuya v3.5 frame suffix")
    aad = frame[4:18]
    iv = frame[18:30]
    ct_tag = frame[30:18 + length]
    try:
        plaintext = AESGCM(key).decrypt(iv, ct_tag, aad)
    except Exception as exc:
        raise TuyaError("Tuya v3.5 AES-GCM decryption failed") from exc
    return seq, cmd, plaintext


def _recv_exact(sock: socket.socket, count: int) -> bytes:
    chunks = bytearray()
    while len(chunks) < count:
        chunk = sock.recv(count - len(chunks))
        if not chunk:
            raise TuyaUnavailable("Tuya device closed connection")
        chunks.extend(chunk)
    return bytes(chunks)


def _recv_frame(sock: socket.socket) -> bytes:
    header = _recv_exact(sock, HEADER_6699.size)
    magic, _ver, _seq, _cmd, length = HEADER_6699.unpack(header)
    if magic != MAGIC_PREFIX or length < 28 or length > 65536:
        raise TuyaError(f"Unexpected Tuya v3.5 frame header: magic=0x{magic:08x} len={length}")
    rest = _recv_exact(sock, length + SUFFIX_6699.size)
    return header + rest


def _derive_session_key(local_key: bytes, client_nonce: bytes, srv_nonce: bytes) -> bytes:
    xored = bytes(a ^ b for a, b in zip(client_nonce, srv_nonce))
    return AESGCM(local_key).encrypt(client_nonce[:12], xored, b"")[:16]


def _parse_dps_body(body: bytes) -> dict[str, Any]:
    if len(body) < 4:
        return {}
    # Responses prefix a 4-byte return code; command echoes may also prepend the 15-byte 3.5 header.
    payload = body[4:]
    if payload.startswith(b"3.5"):
        idx = payload.find(b"{")
        payload = payload[idx:] if idx != -1 else b""
    if not payload:
        return {}
    parsed = json.loads(payload.decode("utf-8"))
    if isinstance(parsed, dict):
        if isinstance(parsed.get("dps"), dict):
            return parsed["dps"]
        if isinstance(parsed.get("data"), dict) and isinstance(parsed["data"].get("dps"), dict):
            return parsed["data"]["dps"]
    return {}


class TuyaProvider:
    """Expose locally controlled Tuya v3.5 devices as Home Dashboard entities."""

    name = "tuya"

    def __init__(self, config: dict[str, Any] | None = None):
        config = config or {}
        self.timeout = max(0.5, min(15.0, float(config.get("timeout", 3.0))))
        self.retries = max(1, min(3, int(config.get("retries", 2))))
        self.devices: dict[str, dict[str, Any]] = {}
        self._entities: dict[str, dict[str, Any]] = {}
        self._locks: dict[str, threading.Lock] = {}
        for raw in config.get("devices", []):
            self._add_device(raw)

    @property
    def enabled(self) -> bool:
        return bool(self.devices)

    def _add_device(self, raw: dict[str, Any]) -> None:
        device_id = str(raw.get("device_id", "")).strip()
        if not device_id:
            raise ValueError("Tuya device_id is required")
        local_key = str(raw.get("local_key", ""))
        key_bytes = local_key.encode("utf-8")
        if len(key_bytes) != 16:
            raise ValueError("Tuya local_key must be 16 bytes")
        ip = str(raw.get("ip", "")).strip()
        ipaddress.IPv4Address(ip)
        item_id = _safe_id(str(raw.get("id") or device_id))
        if not item_id or item_id in self.devices:
            raise ValueError(f"Duplicate or invalid Tuya device id: {item_id!r}")
        version = str(raw.get("version", "3.5")).strip()
        if version != "3.5":
            raise ValueError(f"Unsupported Tuya protocol version {version!r}; expected '3.5'")
        port = int(raw.get("port", TUYA_PORT))
        dp_id = str(raw.get("dp_id", "1")).strip() or "1"
        name = str(raw.get("name") or "Tuya Smart Plug")[:80]
        room = str(raw.get("room") or "Home")[:60]
        icon = str(raw.get("icon") or "🔌")[:8]

        self.devices[item_id] = {
            "id": item_id,
            "device_id": device_id,
            "key": key_bytes,
            "ip": ip,
            "port": port,
            "dp_id": dp_id,
            "name": name,
            "room": room,
        }
        self._locks[item_id] = threading.Lock()
        self._entities[item_id] = {
            "id": item_id,
            "entity_id": f"tuya.{item_id}.switch_{dp_id}",
            "name": name,
            "room": room,
            "icon": icon,
            "type": "switch",
            "read_only": False,
            "provider": self.name,
            "device_id": item_id,
            "device_name": name,
        }

    def entities(self) -> list[dict[str, Any]]:
        return [item.copy() for item in self._entities.values()]

    def _handshake(self, sock: socket.socket, key: bytes) -> tuple[bytes, int]:
        client_nonce = os.urandom(16)
        sock.sendall(_pack_6699(1, CMD_SESS_KEY_NEG_START, client_nonce, key))
        _, cmd, resp = _unpack_6699(_recv_frame(sock), key)
        if cmd != CMD_SESS_KEY_NEG_RESP or len(resp) < 52:
            raise TuyaError("Invalid Tuya session key response")
        srv_nonce = resp[4:20]
        srv_hmac = resp[20:52]
        expected = hmac.new(key, client_nonce, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, srv_hmac):
            raise TuyaError("Tuya session HMAC verification failed")
        sess_key = _derive_session_key(key, client_nonce, srv_nonce)
        finish = hmac.new(key, srv_nonce, hashlib.sha256).digest()
        sock.sendall(_pack_6699(2, CMD_SESS_KEY_NEG_FINISH, finish, key))
        return sess_key, 3

    def _query_dps_once(self, dev: dict[str, Any]) -> dict[str, Any]:
        with socket.create_connection((dev["ip"], dev["port"]), timeout=self.timeout) as sock:
            sock.settimeout(self.timeout)
            sess_key, seq = self._handshake(sock, dev["key"])
            sock.sendall(_pack_6699(seq, CMD_DP_QUERY_NEW, b"{}", sess_key))
            _, _cmd, body = _unpack_6699(_recv_frame(sock), sess_key)
            return _parse_dps_body(body)

    def _set_dp_once(self, dev: dict[str, Any], value: bool) -> dict[str, Any]:
        with socket.create_connection((dev["ip"], dev["port"]), timeout=self.timeout) as sock:
            sock.settimeout(self.timeout)
            sess_key, seq = self._handshake(sock, dev["key"])
            payload = json.dumps(
                {"protocol": 5, "t": int(time.time()), "data": {"dps": {dev["dp_id"]: value}}},
                separators=(",", ":"),
            ).encode("utf-8")
            sock.sendall(_pack_6699(seq, CMD_CONTROL_NEW, VERSION_HEADER_35 + payload, sess_key))
            dps: dict[str, Any] = {}
            try:
                _, cmd, body = _unpack_6699(_recv_frame(sock), sess_key)
                if cmd in (CMD_STATUS, CMD_CONTROL_NEW, CMD_DP_QUERY_NEW):
                    dps = _parse_dps_body(body)
            except (socket.timeout, TuyaUnavailable):
                pass
            if dev["dp_id"] not in dps:
                sock.sendall(_pack_6699(seq + 1, CMD_DP_QUERY_NEW, b"{}", sess_key))
                _, _cmd, body = _unpack_6699(_recv_frame(sock), sess_key)
                dps = _parse_dps_body(body)
            return dps

    def _run_with_retry(self, item_id: str, fn, *args):
        dev = self.devices[item_id]
        last_exc: Exception | None = None
        with self._locks[item_id]:
            for attempt in range(self.retries):
                try:
                    return fn(dev, *args)
                except (OSError, TuyaError, json.JSONDecodeError) as exc:
                    last_exc = exc
                    if attempt + 1 < self.retries:
                        time.sleep(0.15)
        raise TuyaUnavailable(f"Could not reach Tuya device {item_id}: {last_exc}") from last_exc

    @staticmethod
    def _attributes_from_dps(dev: dict[str, Any], dps: dict[str, Any]) -> dict[str, Any]:
        attrs: dict[str, Any] = {"ip": dev["ip"], "tuya_id": dev["device_id"]}
        if "19" in dps and isinstance(dps["19"], (int, float)):
            attrs["power"] = round(float(dps["19"]) / 10.0, 1)
        if "18" in dps and isinstance(dps["18"], (int, float)):
            attrs["current_ma"] = int(dps["18"])
        if "20" in dps and isinstance(dps["20"], (int, float)):
            attrs["voltage_v"] = round(float(dps["20"]) / 10.0, 1)
        return attrs

    def states(self) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        for item_id, dev in self.devices.items():
            try:
                dps = self._run_with_retry(item_id, self._query_dps_once)
                raw_state = dps.get(dev["dp_id"])
                state = "on" if raw_state is True else "off" if raw_state is False else "unavailable"
                attrs = self._attributes_from_dps(dev, dps)
            except TuyaError as exc:
                log.warning("%s", exc)
                state = "unavailable"
                attrs = {"ip": dev["ip"], "tuya_id": dev["device_id"]}
            result.append({"id": item_id, "state": state, "attributes": attrs})
        return result

    def command(self, item_id: str, action: str, _data: dict[str, Any] | None = None) -> dict[str, Any]:
        if item_id not in self.devices:
            raise KeyError(item_id)
        if action not in {"turn_on", "turn_off"}:
            raise ValueError("Tuya switches support only turn_on and turn_off")
        desired = action == "turn_on"
        dps = self._run_with_retry(item_id, self._set_dp_once, desired)
        dev = self.devices[item_id]
        if bool(dps.get(dev["dp_id"])) != desired:
            raise TuyaError(f"Tuya device {item_id} did not change to {action}")
        return {"ok": True, "state": "on" if desired else "off"}
