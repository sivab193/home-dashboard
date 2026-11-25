import hashlib
import hmac
import json
import socket
import struct
import threading
import unittest

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from service.tuya import (
    CMD_CONTROL_NEW,
    CMD_DP_QUERY_NEW,
    CMD_SESS_KEY_NEG_FINISH,
    CMD_SESS_KEY_NEG_RESP,
    CMD_SESS_KEY_NEG_START,
    CMD_STATUS,
    TuyaProvider,
    _derive_session_key,
    _pack_6699,
    _recv_frame,
    _unpack_6699,
)

TEST_KEY = b"0123456789abcdef"


def _run_fake_tuya_server(initial_on: bool = True):
    state = {"on": initial_on}
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.bind(("127.0.0.1", 0))
    srv.listen(4)
    port = srv.getsockname()[1]

    def serve():
        while True:
            try:
                conn, _ = srv.accept()
            except OSError:
                break
            with conn:
                try:
                    _, cmd, client_nonce = _unpack_6699(_recv_frame(conn), TEST_KEY)
                    if cmd != CMD_SESS_KEY_NEG_START:
                        continue
                    srv_nonce = b"fedcba9876543210"
                    srv_hmac = hmac.new(TEST_KEY, client_nonce, hashlib.sha256).digest()
                    conn.sendall(
                        _pack_6699(1, CMD_SESS_KEY_NEG_RESP, b"\x00\x00\x00\x00" + srv_nonce + srv_hmac, TEST_KEY)
                    )
                    _, cmd2, _fin = _unpack_6699(_recv_frame(conn), TEST_KEY)
                    if cmd2 != CMD_SESS_KEY_NEG_FINISH:
                        continue
                    sess_key = _derive_session_key(TEST_KEY, client_nonce, srv_nonce)
                    _, cmd3, req_body = _unpack_6699(_recv_frame(conn), sess_key)
                    if cmd3 == CMD_DP_QUERY_NEW:
                        resp = json.dumps({"dps": {"1": state["on"], "18": 150, "19": 124, "20": 1205}}).encode()
                        conn.sendall(_pack_6699(3, CMD_DP_QUERY_NEW, b"\x00\x00\x00\x00" + resp, sess_key))
                    elif cmd3 == CMD_CONTROL_NEW:
                        idx = req_body.find(b"{")
                        parsed = json.loads(req_body[idx:].decode())
                        state["on"] = bool(parsed["data"]["dps"]["1"])
                        resp = b"3.5" + b"\x00" * 12 + json.dumps({"protocol": 4, "data": {"dps": {"1": state["on"]}}}).encode()
                        conn.sendall(_pack_6699(3, CMD_STATUS, b"\x00\x00\x00\x00" + resp, sess_key))
                except OSError:
                    pass

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    return srv, port, state


class TuyaProtocolTests(unittest.TestCase):
    def test_6699_frame_roundtrip(self):
        frame = _pack_6699(7, CMD_DP_QUERY_NEW, b"{}", TEST_KEY)
        seq, cmd, plaintext = _unpack_6699(frame, TEST_KEY)
        self.assertEqual(seq, 7)
        self.assertEqual(cmd, CMD_DP_QUERY_NEW)
        self.assertEqual(plaintext, b"{}")

    def test_provider_validates_key_length(self):
        with self.assertRaises(ValueError):
            TuyaProvider({"devices": [{
                "id": "bad_plug",
                "device_id": "abc",
                "local_key": "short",
                "ip": "192.0.2.10",
            }]})

    def test_states_and_command_over_v35_session(self):
        srv, port, state = _run_fake_tuya_server(initial_on=True)
        try:
            provider = TuyaProvider({"devices": [{
                "id": "wipro_smart_plug",
                "name": "Wipro Smart Plug",
                "room": "Living room",
                "device_id": "tuya0000000000000001",
                "local_key": TEST_KEY.decode(),
                "ip": "127.0.0.1",
                "port": port,
                "version": "3.5",
            }]})
            entities = provider.entities()
            self.assertEqual(len(entities), 1)
            self.assertEqual(entities[0]["provider"], "tuya")

            states = provider.states()
            self.assertEqual(states[0]["state"], "on")
            self.assertEqual(states[0]["attributes"]["power"], 12.4)
            self.assertEqual(states[0]["attributes"]["current_ma"], 150)
            self.assertEqual(states[0]["attributes"]["voltage_v"], 120.5)

            res = provider.command("wipro_smart_plug", "turn_off")
            self.assertEqual(res, {"ok": True, "state": "off"})
            self.assertFalse(state["on"])

            states_after = provider.states()
            self.assertEqual(states_after[0]["state"], "off")
        finally:
            srv.close()


if __name__ == "__main__":
    unittest.main()
