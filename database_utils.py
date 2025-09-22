import os
import re
from pathlib import Path

import pymysql
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

# Database configuration
DB_NAME = os.environ.get('DB_NAME', 'lexi_db')

def sanitize_column_name(text):
    return re.sub(r'[^a-zA-Z0-9]', '_', text).strip('_')

def connectDB(database_name):
    """Database connection function"""
    try:
        connection = pymysql.connect(
            host=os.environ.get('DB_HOST', 'localhost'),
            user=os.environ.get('DB_USER', 'root'),
            password=os.environ.get('SQL_PASS', ''),  # Use SQL_PASS from your .env
            database=database_name,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        return connection
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def db_operation(query, params=None, fetch_one=False, fetch_all=False):
    """Generic database operation handler"""
    conn = None
    try:
        print(f"[DB] Attempting to connect to database: {DB_NAME}")
        conn = connectDB(DB_NAME)
        if not conn:
            print("[DB] Failed to connect to database")
            return False

        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(query, params or ())
            conn.commit()
            if query.strip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')):
                result = cursor.rowcount > 0
                print(f"[DB] Query executed: {query[:50]}... - Rows affected: {cursor.rowcount}")
                return result
            elif fetch_one:
                result = cursor.fetchone()
                print(f"[DB] Query executed: {query[:50]}... - Fetched 1 row")
                return result
            elif fetch_all:
                result = cursor.fetchall()
                print(f"[DB] Query executed: {query[:50]}... - Fetched {len(result)} rows")
                return result
            return True
    except Exception as e:
        print(f"[DB] Database error: {e}")
        return False
    finally:
        if conn:
            conn.close()

def expire_old_tasks():
    """Expire old tasks that haven't been completed"""
    from datetime import datetime, timedelta

    workspaces = db_operation('SELECT * FROM workspaces', fetch_all=True) or []
    now = datetime.now()
    for ws in workspaces:
        ws_id = ws['id']
        table_name = f"workspace_{ws_id}_responses"
        # Expire tasks not accepted within 24h of assignment
        db_operation(
            f"""
            UPDATE {table_name}
            SET task_status = 'incomplete'
            WHERE
                task_status IN ('created', 'assigned')
                AND time_task_assigned IS NOT NULL
                AND time_task_responded IS NULL
                AND time_task_assigned < %s
            """,
            [(now - timedelta(hours=24)).strftime('%Y-%m-%d %H:%M:%S')]
        )
        # Expire tasks not completed within 24h of acceptance
        db_operation(
            f"""
            UPDATE {table_name}
            SET task_status = 'incomplete'
            WHERE
                task_status = 'accepted'
                AND time_task_responded IS NOT NULL
                AND time_completed IS NULL
                AND time_task_responded < %s
            """,
            [(now - timedelta(hours=24)).strftime('%Y-%m-%d %H:%M:%S')]
        )
