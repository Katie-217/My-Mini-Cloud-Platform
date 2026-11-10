"""Kết nối SQL Server; không xuất secret hoặc connection string vào log."""
import os

import pyodbc


def connection(admin=False, database=None):
    def escaped(value):
        return '{' + str(value).replace('}', '}}') + '}'

    user = 'sa' if admin else os.environ.get('DB_USER', 'cloud_app')
    password = os.environ['MSSQL_SA_PASSWORD'] if admin else os.environ['DB_PASSWORD']
    parts = {
        'DRIVER': 'ODBC Driver 18 for SQL Server',
        'SERVER': f"{os.environ.get('DB_HOST', 'relational-database-server')},{os.environ.get('DB_PORT', '1433')}",
        'DATABASE': database or os.environ.get('DB_NAME', 'studentdb'),
        'UID': user,
        'PWD': password,
        'Encrypt': 'yes',
        'TrustServerCertificate': os.environ.get('DB_TRUST_CERTIFICATE', 'yes'),
    }
    return pyodbc.connect(';'.join(f'{key}={escaped(value)}' for key, value in parts.items()), timeout=5)
