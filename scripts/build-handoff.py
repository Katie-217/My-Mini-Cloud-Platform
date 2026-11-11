"""Xuất chính hướng dẫn thành một HTML có ảnh nhúng tại từng bước, đọc offline."""
import base64
import html
import json
import re
import sys
from pathlib import Path

import markdown

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[1]
evidence = root / '.runtime' / 'handoff'
source = (root / 'docs' / 'screenshot-guide.md').read_text(encoding='utf-8-sig')
images = 0
cases = 0


def embedded_image(path, description):
    global images
    if not path.is_file():
        raise RuntimeError(f'Missing evidence {path.name}; run capture-handoff.py first.')
    images += 1
    data = base64.b64encode(path.read_bytes()).decode('ascii')
    return f'<img loading="lazy" src="data:image/png;base64,{data}" alt="{html.escape(description, quote=True)}">'


def command_evidence(match):
    global cases
    key = match.group(1)
    entry = json.loads((evidence / f'{key}.json').read_text(encoding='utf-8'))
    if entry['exit_code'] != 0 or not entry.get('images'):
        raise RuntimeError(f'No successful captured evidence for {key}; do not publish a PASS example.')
    cases += 1
    result = '<div class="evidence"><p><strong>Response chạy thật: ' + html.escape(entry['title']) + '</strong><br><small>'
    result += html.escape(entry['captured_at']) + ' · Exit code ' + str(entry['exit_code']) + '</small></p>'
    result += '<details><summary>Xem/copy chính xác lệnh đã chạy trong ảnh</summary><pre><code>'
    result += html.escape(entry['command']) + '</code></pre></details>'
    for index, name in enumerate(entry['images']):
        result += '<figure>' + embedded_image(evidence / name, entry['title'] + f' — phần {index+1}')
        result += '<figcaption>Ảnh hiển thị transcript thực thi thật; phần ' + str(index+1) + '/' + str(len(entry['images'])) + '.</figcaption></figure>'
    return result + '</div>\n'


def ui_evidence(match):
    name = match.group(1)
    descriptions = {
        'portal-ui': 'Portal Services sau khi nhận probe thật',
        'blog-ui': 'Blog phục vụ qua gateway localhost',
        'keycloak-ui': 'Keycloak login form trước khi nhập credential',
        'auth-ui': 'Portal Xác thực hiển thị realm chung và nút đăng nhập SSO',
        'minio-ui': 'MinIO Console sau login thật, hai bucket private',
        'prometheus-ui': 'Prometheus Targets trên browser',
        'grafana-ui': 'Grafana sau login thật, ba biểu đồ dữ liệu',
    }
    description = descriptions[name]
    return '<figure>' + embedded_image(evidence / f'{name}.png', description) + '<figcaption>' + html.escape(description) + ' — ảnh trình duyệt thật.</figcaption></figure>\n'


# Thay marker trong nội dung HTML sau Markdown để không diễn giải output thành code.
heading, remainder = source.split('\n', 1)
body = markdown.markdown(heading + '\n\n[TOC]\n' + remainder, extensions=['tables', 'fenced_code', 'toc'])
body = re.sub(r'<!-- evidence:([\w-]+) -->', command_evidence, body)
body = re.sub(r'<!-- ui:([\w-]+) -->', ui_evidence, body)
if 'data:image/png;base64,' not in body or re.search(r'<!-- (?:evidence|ui):', body):
    raise RuntimeError('Missing embedded screenshots; handoff was not exported.')
css = '''
*{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#172033;font:16px/1.75 "Segoe UI",Arial,sans-serif}
main{max-width:1140px;margin:28px auto;padding:32px 44px;background:white;border-radius:12px}
h1,h2,h3{line-height:1.35;color:#122443}h1{font-size:32px}h2{font-size:25px;border-top:2px solid #dbe5f2;padding-top:26px;margin-top:36px}
a{color:#1754ad}code{font-family:Consolas,monospace;font-size:.9em;overflow-wrap:anywhere}pre{background:#101827;color:#edf3ff;padding:18px;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}
table{border-collapse:collapse;width:100%;margin:18px 0;font-size:15px}td,th{border:1px solid #d8dfeb;padding:9px 12px;text-align:left;vertical-align:top}th{background:#eff4fa}
figure{margin:18px 0 28px}img{display:block;width:100%;height:auto;border:1px solid #cbd5e1;border-radius:8px}figcaption{color:#526078;font-size:14px;margin-top:8px}
.evidence{border-left:4px solid #1f8d69;padding-left:18px;margin:25px 0}small{color:#596a80}summary{cursor:pointer;color:#1652a3}.toc{padding:18px 28px;background:#f2f6fc;border-radius:8px}.toc ul{margin:4px 0}
@media(max-width:800px){main{margin:0;padding:18px}h1{font-size:26px}table{display:block;overflow:auto}}
@media print{body{background:white}main{margin:0;padding:0;max-width:none}.toc{break-after:page}h2{break-before:page}figure{break-inside:avoid}details{display:none}a{color:#172033;text-decoration:none}}
'''
page = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MyMiniCloud — Setup và kiểm thử thủ công</title><style>' + css + '</style></head><body><main>' + body + '</main></body></html>'
target = root / 'docs' / 'screenshot-guide.html'
target.write_text(page, encoding='utf-8')
guide = root / 'guide'
guide.mkdir(exist_ok=True)
(guide / 'screenshot-guide.md').write_text(source, encoding='utf-8')
(guide / 'screenshot-guide.html').write_text(page, encoding='utf-8')
print(f'PASS: {cases} executed response sections and {images} screenshots embedded in {target.name}; no external image files required.')
