"""Tạo fixture PNG/PDF riêng, không phụ thuộc tài liệu đề bài hoặc dữ liệu cá nhân."""
import base64
from pathlib import Path

root = Path(__file__).resolve().parents[1]
target = root / '.runtime' / 'demo-files'
target.mkdir(parents=True, exist_ok=True)
content = b'BT /F1 18 Tf 40 240 Td (MyMiniCloud storage demo) Tj ET\n'
objects = [b'<< /Type /Catalog /Pages 2 0 R >>',
           b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
           b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
           b'<< /Length ' + str(len(content)).encode() + b' >>\nstream\n' + content + b'endstream',
           b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
data = b'%PDF-1.4\n'
offsets = []
for number, obj in enumerate(objects, 1):
    offsets.append(len(data))
    data += f'{number} 0 obj\n'.encode() + obj + b'\nendobj\n'
xref = len(data)
data += b'xref\n0 6\n0000000000 65535 f \n'
data += b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets)
data += b'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + str(xref).encode() + b'\n%%EOF\n'
(target / 'report.pdf').write_bytes(data)
(target / 'avatar.png').write_bytes(base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII='))
print('PASS: Demo PDF and PNG created in .runtime/demo-files; no assignment PDF required.')
