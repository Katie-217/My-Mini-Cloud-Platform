"""REST API thật cho MyMiniCloud; chạy qua Gunicorn."""
import json
import math
import re
from datetime import date
from decimal import Decimal
from pathlib import Path

import pyodbc
from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

from database import connection

app = Flask(__name__)
app.json.ensure_ascii = False
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024 + 64 * 1024
COLUMNS = 'id, student_id, fullname, dob, major, gpa, avatar_key, created_at'


def serialize(cursor, row):
    result = dict(zip([column[0] for column in cursor.description], row))
    for key, value in result.items():
        if hasattr(value, 'isoformat'):
            result[key] = value.isoformat()
        elif isinstance(value, Decimal):
            result[key] = float(value)
    return result


def query_one(student_id):
    conn = connection()
    try:
        cursor = conn.execute(f'SELECT {COLUMNS} FROM dbo.students WHERE id=?', student_id)
        row = cursor.fetchone()
        return serialize(cursor, row) if row else None
    finally:
        conn.close()


def validate(body):
    if not isinstance(body, dict):
        raise ValueError('Body phải là JSON object.')
    data = {}
    for field, maximum in [('student_id', 10), ('fullname', 100), ('major', 50)]:
        value = body.get(field)
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > maximum:
            raise ValueError(f'{field} bắt buộc và tối đa {maximum} ký tự.')
        data[field] = value.strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,10}', data['student_id']):
        raise ValueError('Mã sinh viên chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới.')
    try:
        data['dob'] = date.fromisoformat(body['dob'])
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', body['dob']) or data['dob'] > date.today():
            raise ValueError()
    except (KeyError, TypeError, ValueError):
        raise ValueError('Ngày sinh cần đúng YYYY-MM-DD và không nằm trong tương lai.') from None
    try:
        if isinstance(body.get('gpa'), bool):
            raise ValueError()
        data['gpa'] = float(body.get('gpa', 0))
        if not math.isfinite(data['gpa']) or not 0 <= data['gpa'] <= 4:
            raise ValueError()
    except (TypeError, ValueError):
        raise ValueError('GPA phải là số từ 0 đến 4.') from None
    avatar = body.get('avatar_key')
    if avatar is not None and (not isinstance(avatar, str) or len(avatar) > 250
                               or not re.fullmatch(r'[A-Za-z0-9_.-]+', avatar)):
        raise ValueError('avatar_key không hợp lệ.')
    data['avatar_key'] = avatar
    return data


@app.errorhandler(ValueError)
def bad_input(error):
    return jsonify(error=str(error)), 400


@app.errorhandler(pyodbc.Error)
def database_error(error):
    # SQLSTATE lớp 23 là integrity violation; không trả chi tiết SQL/password.
    if error.args and str(error.args[0]).startswith('23'):
        return jsonify(error='Mã sinh viên đã tồn tại hoặc dữ liệu vi phạm ràng buộc.'), 409
    app.logger.error('SQL Server request failed (%s)', type(error).__name__)
    return jsonify(error='Không thể kết nối hoặc truy vấn SQL Server.'), 503


@app.errorhandler(HTTPException)
def http_error(error):
    return jsonify(error=error.description), error.code


@app.get('/hello')
def hello():
    return jsonify(message='Hello from App Server!', service='application-backend-server')


@app.get('/student')
@app.get('/student/')
def student():
    return jsonify(json.loads(Path(__file__).with_name('students.json').read_text(encoding='utf-8'))[:5])


@app.get('/health')
def health():
    try:
        conn = connection()
        try:
            conn.execute('SELECT TOP (1) id FROM dbo.students').fetchone()
        finally:
            conn.close()
        return jsonify(status='healthy', service='application-backend-server', database='healthy')
    except Exception:
        return jsonify(status='unhealthy', service='application-backend-server', database='unhealthy'), 503


@app.get('/students-db')
def list_students():
    q = request.args.get('q', '').strip()[:100]
    conn = connection()
    try:
        if q:
            # Escape wildcard để tìm đúng tên/mã, parameter binding ngăn SQL injection.
            escaped = q.replace('~', '~~').replace('%', '~%').replace('_', '~_').replace('[', '~[')
            cursor = conn.execute(f"SELECT {COLUMNS} FROM dbo.students WHERE fullname LIKE ? ESCAPE '~' OR student_id LIKE ? ESCAPE '~' ORDER BY id DESC", f'%{escaped}%', f'%{escaped}%')
        else:
            cursor = conn.execute(f'SELECT {COLUMNS} FROM dbo.students ORDER BY id DESC')
        return jsonify([serialize(cursor, row) for row in cursor.fetchall()])
    finally:
        conn.close()


@app.get('/students-db/<int:student_id>')
def get_student(student_id):
    result = query_one(student_id)
    return jsonify(result) if result else (jsonify(error='Không tìm thấy sinh viên.'), 404)


@app.route('/students-db', methods=['POST'])
def add_student():
    data = validate(request.get_json())
    conn = connection()
    try:
        cursor = conn.execute('INSERT dbo.students(student_id,fullname,dob,major,gpa,avatar_key) OUTPUT INSERTED.id VALUES (?,?,?,?,?,?)',
                              data['student_id'], data['fullname'], data['dob'], data['major'], data['gpa'], data['avatar_key'])
        new_id = cursor.fetchone()[0]
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return jsonify(query_one(new_id)), 201


@app.route('/students-db/<int:student_id>', methods=['PUT', 'DELETE'])
def change_student(student_id):
    data = validate(request.get_json()) if request.method == 'PUT' else None
    conn = connection()
    try:
        if data:
            cursor = conn.execute('UPDATE dbo.students SET student_id=?,fullname=?,dob=?,major=?,gpa=?,avatar_key=? OUTPUT INSERTED.id WHERE id=?',
                                  data['student_id'], data['fullname'], data['dob'], data['major'], data['gpa'], data['avatar_key'], student_id)
        else:
            cursor = conn.execute('DELETE FROM dbo.students OUTPUT DELETED.id WHERE id=?', student_id)
        changed = cursor.fetchone()
        if not changed:
            conn.rollback()
            return jsonify(error='Không tìm thấy sinh viên.'), 404
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return jsonify(query_one(student_id)) if data else jsonify(message='Student deleted', id=student_id)


from integrations import integrations
app.register_blueprint(integrations)
