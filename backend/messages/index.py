import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управление сообщениями в чатах - получение и отправка
    Args: event - dict с httpMethod, body, queryStringParameters
          context - объект с request_id
    Returns: HTTP response с сообщениями
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
        params = event.get('queryStringParameters') or {}
        chat_id = params.get('chat_id')
        
        if not chat_id:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'chat_id required'}),
                'isBase64Encoded': False
            }
        
        cur.execute("""
            SELECT m.id, m.sender_type, m.message, m.created_at, e.name as sender_name
            FROM messages m
            LEFT JOIN employees e ON m.sender_id = e.id
            WHERE m.chat_id = %s
            ORDER BY m.created_at ASC
        """, (chat_id,))
        
        messages = cur.fetchall()
        result = []
        for msg in messages:
            result.append({
                'id': msg[0],
                'sender_type': msg[1],
                'message': msg[2],
                'created_at': msg[3].isoformat() if msg[3] else None,
                'sender_name': msg[4]
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
        chat_id = body_data.get('chat_id')
        sender_type = body_data.get('sender_type', 'user')
        sender_id = body_data.get('sender_id')
        message = body_data.get('message', '')
        
        if not chat_id or not message:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'chat_id and message required'}),
                'isBase64Encoded': False
            }
        
        if sender_id:
            cur.execute(
                "INSERT INTO messages (chat_id, sender_type, sender_id, message) VALUES (%s, %s, %s, %s) RETURNING id",
                (chat_id, sender_type, sender_id, message)
            )
        else:
            cur.execute(
                "INSERT INTO messages (chat_id, sender_type, message) VALUES (%s, %s, %s) RETURNING id",
                (chat_id, sender_type, message)
            )
        
        message_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'statusCode': 201,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message_id': message_id}),
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
