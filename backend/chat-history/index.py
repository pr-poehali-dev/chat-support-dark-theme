import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Получение истории изменений чата
    Args: event - dict с httpMethod, queryStringParameters (chat_id)
          context - объект с request_id
    Returns: HTTP response с историей чата
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    params = event.get('queryStringParameters') or {}
    chat_id = params.get('chat_id')
    
    if not chat_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'chat_id required'}),
            'isBase64Encoded': False
        }
    
    database_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT h.id, h.action, h.details, h.created_at, e.name as employee_name
        FROM chat_history h
        LEFT JOIN employees e ON h.employee_id = e.id
        WHERE h.chat_id = %s
        ORDER BY h.created_at ASC
    """, (chat_id,))
    
    history = cur.fetchall()
    result = []
    for item in history:
        result.append({
            'id': item[0],
            'action': item[1],
            'details': item[2],
            'created_at': item[3].isoformat() if item[3] else None,
            'employee_name': item[4]
        })
    
    cur.close()
    conn.close()
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(result),
        'isBase64Encoded': False
    }
