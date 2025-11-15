import json
import os
import psycopg2
from typing import Dict, Any
from datetime import datetime

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управление чатами - создание, получение списка, назначение оператору
    Args: event - dict с httpMethod, body, queryStringParameters
          context - объект с request_id
    Returns: HTTP response с данными чатов
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    database_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    
    if method == 'GET':
        params = event.get('queryStringParameters') or {}
        operator_id = params.get('operator_id')
        
        if operator_id:
            cur.execute("""
                SELECT c.id, c.user_name, c.user_email, c.status, c.assigned_to, 
                       c.created_at, e.name as operator_name
                FROM chats c
                LEFT JOIN employees e ON c.assigned_to = e.id
                WHERE c.assigned_to = %s
                ORDER BY c.created_at DESC
            """, (operator_id,))
        else:
            cur.execute("""
                SELECT c.id, c.user_name, c.user_email, c.status, c.assigned_to, 
                       c.created_at, e.name as operator_name
                FROM chats c
                LEFT JOIN employees e ON c.assigned_to = e.id
                ORDER BY c.created_at DESC
            """)
        
        chats = cur.fetchall()
        result = []
        for chat in chats:
            result.append({
                'id': chat[0],
                'user_name': chat[1],
                'user_email': chat[2],
                'status': chat[3],
                'assigned_to': chat[4],
                'created_at': chat[5].isoformat() if chat[5] else None,
                'operator_name': chat[6]
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
        user_name = body_data.get('user_name', '')
        user_email = body_data.get('user_email', '')
        message = body_data.get('message', '')
        
        if not user_name or not message:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'User name and message required'}),
                'isBase64Encoded': False
            }
        
        cur.execute(
            "SELECT id FROM employees WHERE status = 'online' AND role = 'operator' ORDER BY id LIMIT 1"
        )
        operator = cur.fetchone()
        
        if operator:
            cur.execute(
                "INSERT INTO chats (user_name, user_email, status, assigned_to) VALUES (%s, %s, 'assigned', %s) RETURNING id",
                (user_name, user_email, operator[0])
            )
        else:
            cur.execute(
                "INSERT INTO chats (user_name, user_email, status) VALUES (%s, %s, 'waiting') RETURNING id",
                (user_name, user_email)
            )
        
        chat_id = cur.fetchone()[0]
        
        cur.execute(
            "INSERT INTO messages (chat_id, sender_type, message) VALUES (%s, 'user', %s)",
            (chat_id, message)
        )
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'statusCode': 201,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'chat_id': chat_id, 'status': 'assigned' if operator else 'waiting'}),
            'isBase64Encoded': False
        }
    
    elif method == 'PUT':
        body_data = json.loads(event.get('body', '{}'))
        chat_id = body_data.get('chat_id')
        status = body_data.get('status')
        
        if chat_id and status:
            cur.execute(
                "UPDATE chats SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                (status, chat_id)
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
