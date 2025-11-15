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
        role = params.get('role')
        include_closed = params.get('include_closed', 'false') == 'true'
        
        if operator_id and role == 'operator':
            if include_closed:
                cur.execute("""
                    SELECT c.id, c.user_name, c.user_email, c.status, c.assigned_to, 
                           c.created_at, e.name as operator_name, c.is_closed, c.resolution_status
                    FROM chats c
                    LEFT JOIN employees e ON c.assigned_to = e.id
                    WHERE c.assigned_to = %s
                    ORDER BY c.is_closed ASC, c.created_at DESC
                """, (operator_id,))
            else:
                cur.execute("""
                    SELECT c.id, c.user_name, c.user_email, c.status, c.assigned_to, 
                           c.created_at, e.name as operator_name, c.is_closed, c.resolution_status
                    FROM chats c
                    LEFT JOIN employees e ON c.assigned_to = e.id
                    WHERE c.assigned_to = %s AND c.is_closed = FALSE
                    ORDER BY c.created_at DESC
                """, (operator_id,))
        else:
            cur.execute("""
                SELECT c.id, c.user_name, c.user_email, c.status, c.assigned_to, 
                       c.created_at, e.name as operator_name, c.is_closed, c.resolution_status
                FROM chats c
                LEFT JOIN employees e ON c.assigned_to = e.id
                ORDER BY c.is_closed ASC, c.created_at DESC
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
                'operator_name': chat[6],
                'is_closed': chat[7] if len(chat) > 7 else False,
                'resolution_status': chat[8] if len(chat) > 8 else None
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
            "SELECT id FROM chats WHERE user_email = %s AND is_closed = TRUE AND resolution_status = 'unsolved' ORDER BY updated_at DESC LIMIT 1",
            (user_email,)
        )
        existing_chat = cur.fetchone()
        
        if existing_chat:
            chat_id = existing_chat[0]
            
            cur.execute(
                "SELECT id FROM employees WHERE status = 'online' AND role = 'operator' ORDER BY id LIMIT 1"
            )
            operator = cur.fetchone()
            
            if operator:
                cur.execute(
                    "UPDATE chats SET is_closed = FALSE, status = 'assigned', assigned_to = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (operator[0], chat_id)
                )
                cur.execute(
                    "INSERT INTO chat_history (chat_id, action, details, employee_id) VALUES (%s, 'reopened', 'Chat reopened by client', %s)",
                    (chat_id, operator[0])
                )
            else:
                cur.execute(
                    "UPDATE chats SET is_closed = FALSE, status = 'waiting', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (chat_id,)
                )
                cur.execute(
                    "INSERT INTO chat_history (chat_id, action, details) VALUES (%s, 'reopened', 'Chat reopened by client, waiting for operator')",
                    (chat_id,)
                )
            
            cur.execute(
                "INSERT INTO messages (chat_id, sender_type, message) VALUES (%s, 'user', %s)",
                (chat_id, message)
            )
        else:
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
            
            cur.execute(
                "INSERT INTO chat_history (chat_id, action, details, employee_id) VALUES (%s, 'created', 'New chat created', %s)",
                (chat_id, operator[0] if operator else None)
            )
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'statusCode': 201,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'chat_id': chat_id, 'status': 'assigned' if existing_chat or operator else 'waiting'}),
            'isBase64Encoded': False
        }
    
    elif method == 'PUT':
        body_data = json.loads(event.get('body', '{}'))
        chat_id = body_data.get('chat_id')
        action = body_data.get('action')
        resolution_status = body_data.get('resolution_status')
        employee_id = body_data.get('employee_id')
        
        if action == 'close' and chat_id and resolution_status:
            cur.execute(
                "UPDATE chats SET is_closed = TRUE, status = 'closed', resolution_status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                (resolution_status, chat_id)
            )
            
            details = f"Chat closed as {resolution_status}"
            cur.execute(
                "INSERT INTO chat_history (chat_id, action, details, employee_id) VALUES (%s, 'closed', %s, %s)",
                (chat_id, details, employee_id)
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