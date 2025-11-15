import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управление сотрудниками - список, создание, обновление статуса
    Args: event - dict с httpMethod, body, queryStringParameters
          context - объект с request_id
    Returns: HTTP response с данными сотрудников
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    database_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    
    if method == 'GET':
        cur.execute("""
            SELECT id, login, name, role, status, created_at
            FROM employees
            ORDER BY created_at DESC
        """)
        
        employees = cur.fetchall()
        result = []
        for emp in employees:
            result.append({
                'id': emp[0],
                'login': emp[1],
                'name': emp[2],
                'role': emp[3],
                'status': emp[4],
                'created_at': emp[5].isoformat() if emp[5] else None
            })
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(result),
            'isBase64Encoded': False
        }
    
    elif method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        login = body_data.get('login', '')
        password = body_data.get('password', '')
        name = body_data.get('name', '')
        role = body_data.get('role', 'operator')
        
        if not login or not password or not name:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Login, password and name required'}),
                'isBase64Encoded': False
            }
        
        cur.execute(
            "INSERT INTO employees (login, password, name, role) VALUES (%s, %s, %s, %s) RETURNING id",
            (login, password, name, role)
        )
        
        employee_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'statusCode': 201,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'id': employee_id}),
            'isBase64Encoded': False
        }
    
    elif method == 'PUT':
        body_data = json.loads(event.get('body', '{}'))
        employee_id = body_data.get('id')
        status = body_data.get('status')
        
        if not employee_id or not status:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Employee id and status required'}),
                'isBase64Encoded': False
            }
        
        cur.execute(
            "UPDATE employees SET status = %s WHERE id = %s",
            (status, employee_id)
        )
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': True}),
            'isBase64Encoded': False
        }
    
    cur.close()
    conn.close()
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }
