"""Kiểm tra publish DNS từ Windows, chỉ dùng Python standard library."""
import secrets
import socket
import struct

query_id = secrets.randbelow(65536)
qname = b''.join(bytes([len(part)]) + part.encode() for part in 'app-backend.cloud.local'.split('.')) + b'\x00'
packet = struct.pack('!HHHHHH', query_id, 0x0100, 1, 0, 0, 0) + qname + struct.pack('!HH', 1, 1)


def verify(response, transport):
    actual_id, flags, _, answers, _, _ = struct.unpack('!HHHHHH', response[:12])
    assert actual_id == query_id and flags & 0x000F == 0 and answers >= 1
    assert flags & 0x0400, 'Bind9 response must be authoritative'
    assert socket.inet_ntoa(response[-4:]) == '172.30.50.20'
    print(f'PASS: host 127.0.0.1:1053 {transport} authoritative A record = 172.30.50.20')


with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as client:
    client.settimeout(5)
    client.sendto(packet, ('127.0.0.1', 1053))
    verify(client.recvfrom(4096)[0], 'UDP')
with socket.create_connection(('127.0.0.1', 1053), timeout=5) as client:
    client.sendall(struct.pack('!H', len(packet)) + packet)
    prefix = b''
    while len(prefix) < 2:
        prefix += client.recv(2 - len(prefix))
    length = struct.unpack('!H', prefix)[0]
    data = b''
    while len(data) < length:
        chunk = client.recv(length - len(data))
        if not chunk:
            raise RuntimeError('Incomplete DNS TCP response')
        data += chunk
    verify(data, 'TCP')
