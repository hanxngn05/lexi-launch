import json
import os
import re
import threading
import time
import traceback
from datetime import datetime, timedelta
from pathlib import Path

import pymysql
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from helper_functions import connectDB

from database_utils import db_operation, expire_old_tasks, sanitize_column_name

# from sentiment_analysis import sentiment_analyzer  # COMMENTED OUT - Using proximity only

env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

# Initialize Flask
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def create_workspace_response_table(workspace_id, questions):
    table_name = f"workspace_{workspace_id}_responses"
    columns = [
        "id INT AUTO_INCREMENT PRIMARY KEY",
        "task_id VARCHAR(255) UNIQUE",
        "time_task_created DATETIME",
        "time_task_assigned DATETIME",
        "time_task_responded DATETIME",
        "time_completed DATETIME",
        "user_id VARCHAR(255)",
        "latitude DECIMAL(10, 8)",
        "longitude DECIMAL(11, 8)",
        "task_status VARCHAR(32)"
    ]
    for q in questions:
        col = sanitize_column_name(q['text'])
        columns.append(f"`{col}` TEXT")
    query = f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(columns)})"
    return db_operation(query)

def get_latest_query_time():
    try:
        with open('latest_query_time.txt', 'r') as f:
            lines = f.readlines()
            if not lines:
                return None
            return int(lines[-1].strip())
    except FileNotFoundError:
        return None

def append_latest_query_time():
    current_time = int(time.time())
    with open('latest_query_time.txt', 'a') as f:
        f.write(str(current_time) + '\n')

# Initialize task management system (only once)
def initialize_task_system():
    # Use a lock file to prevent multiple initializations
    lock_file = 'task_system.lock'

    if os.path.exists(lock_file):
        # Check if the lock is stale (older than 5 minutes)
        lock_time = os.path.getmtime(lock_file)
        if time.time() - lock_time > 300:  # 5 minutes
            os.remove(lock_file)
        else:
            print("[TaskSystem] Another instance is already running")
            return

    # Create lock file
    with open(lock_file, 'w') as f:
        f.write(str(time.time()))

    try:
        # Initialize task generation and assignment
        print("[TaskSystem] Initializing task generation and assignment...")

        # Import task modules
        import task_assignment
        import task_creation

        # Start task generation in a separate thread
        def run_task_generation():
            try:
                # Only start if tasks haven't been created today
                if not task_creation.tasks_already_created_today():
                    print("[TaskSystem] Starting task creation thread...")
                    task_creation.run_scheduled_task_creation()
                else:
                    print("[TaskSystem] Tasks already created today, skipping task creation thread")
            except Exception as e:
                print(f"[TaskGeneration] Error: {e}")

        # Start task assignment in a separate thread
        def run_task_assignment():
            try:
                print("[TaskSystem] Starting task assignment thread...")
                task_assignment.run_scheduled_task_assignment()
            except Exception as e:
                print(f"[TaskAssignment] Error: {e}")

        # Start both threads
        import threading
        generation_thread = threading.Thread(target=run_task_generation, daemon=True)
        assignment_thread = threading.Thread(target=run_task_assignment, daemon=True)

        generation_thread.start()
        assignment_thread.start()

        print("[TaskSystem] Task generation and assignment threads started")

    finally:
        def cleanup_lock():
            try:
                if os.path.exists(lock_file):
                    os.remove(lock_file)
            except:
                pass

        # Set up cleanup on exit
        import atexit
        atexit.register(cleanup_lock)

# Initialize task system
initialize_task_system()

''' Routes '''
# Testing endpoint
@app.route("/test", methods=['GET'])
def hello():
    return jsonify({
        "message": "Hello from Flask server!",
        "timestamp": datetime.now().isoformat(),
        "server_info": "HTTP on port 5000"
    })

@app.route("/test-users", methods=['GET'])
def test_users():
    try:
        # Check if table exists
        table_exists = db_operation("SHOW TABLES LIKE 'users_updated'", fetch_one=True)

        if not table_exists:
            return jsonify({
                "error": "users_updated table does not exist",
                "timestamp": datetime.now().isoformat()
            })

        # Get all users
        users = db_operation("SELECT id, name, email, role FROM users_updated", fetch_all=True)

        return jsonify({
            "table_exists": True,
            "user_count": len(users) if users else 0,
            "users": users if users else [],
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500

@app.route("/test-db", methods=['GET'])
def test_db():
    try:
        # Test if users_updated table exists
        tables = db_operation("SHOW TABLES LIKE 'users_updated'", fetch_one=True)
        users_table_exists = tables is not None

        # Test if workspaces table exists
        workspaces_table = db_operation("SHOW TABLES LIKE 'workspaces'", fetch_one=True)
        workspaces_table_exists = workspaces_table is not None

        # Count users in users_updated table
        user_count = 0
        if users_table_exists:
            count_result = db_operation("SELECT COUNT(*) as cnt FROM users_updated", fetch_one=True)
            user_count = count_result['cnt'] if count_result else 0

        return jsonify({
            "users_table_exists": users_table_exists,
            "workspaces_table_exists": workspaces_table_exists,
            "user_count": user_count,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500

@app.route("/create-tables", methods=['POST'])
def create_tables():
    try:
        # Create users_updated table if it doesn't exist
        users_table_query = '''
        CREATE TABLE IF NOT EXISTS users_updated (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            role VARCHAR(50) DEFAULT 'user',
            workspaces JSON,
            anchor_answers JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
        '''
        users_result = db_operation(users_table_query)

        # Create workspaces table if it doesn't exist
        workspaces_table_query = '''
        CREATE TABLE IF NOT EXISTS workspaces (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            developer VARCHAR(255),
            questions JSON,
            main_question VARCHAR(500),
            main_data_type VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
        '''
        workspaces_result = db_operation(workspaces_table_query)

        return jsonify({
            "users_table_created": users_result,
            "workspaces_table_created": workspaces_result,
            "message": "Tables created successfully"
        })
    except Exception as e:
        return jsonify({
            "error": str(e),
            "message": "Failed to create tables"
        }), 500

@app.route("/task-status", methods=['GET'])
def get_task_status():
    """Get the current status of task creation and assignment"""
    try:
        import task_assignment
        import task_creation

        tasks_created_today = task_creation.tasks_already_created_today()
        has_unassigned = task_assignment.has_unassigned_tasks()
        has_eligible_users = task_assignment.has_eligible_users()
        should_run_assignment = task_assignment.should_assign_tasks()

        return jsonify({
            "tasks_created_today": tasks_created_today,
            "has_unassigned_tasks": has_unassigned,
            "has_eligible_users": has_eligible_users,
            "should_run_assignment": should_run_assignment,
            "task_creation_scheduled": f"{task_creation.TASK_CREATION_HOUR}:{task_creation.TASK_CREATION_MINUTE:02d}",
            "task_assignment_scheduled": task_assignment.ASSIGNMENT_HOURS,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })

# Get all users from users_updated table
@app.route('/users', methods=['GET'])
def get_users():
    query = 'SELECT * FROM users_updated ORDER BY created_at DESC'
    result = db_operation(query, fetch_all=True)
    # Ensure workspaces and anchor_answers are always properly formatted
    for user in (result or []):
        if 'workspaces' in user and user['workspaces']:
            try:
                user['workspaces'] = json.loads(user['workspaces'])
            except Exception:
                user['workspaces'] = []
        else:
            user['workspaces'] = []

        if 'anchor_answers' in user and user['anchor_answers']:
            try:
                user['anchor_answers'] = json.loads(user['anchor_answers'])
            except Exception:
                user['anchor_answers'] = {}
        else:
            user['anchor_answers'] = {}
    return jsonify(result if result else [])

@app.route('/users/<email>', methods=['GET'])
def get_user_by_email(email):
    print(f"[DEBUG] Getting user by email: {email}")
    try:
        # First check if the table exists
        table_check = db_operation("SHOW TABLES LIKE 'users_updated'", fetch_one=True)
        print(f"[DEBUG] Table check result: {table_check}")

        if not table_check:
            print("[DEBUG] users_updated table does not exist!")
            return jsonify({"error": "Table does not exist"}), 500

        # Check if there are any users in the table
        count_result = db_operation("SELECT COUNT(*) as cnt FROM users_updated", fetch_one=True)
        print(f"[DEBUG] Total users in table: {count_result}")

        # Get the specific user
        query = 'SELECT * FROM users_updated WHERE email = %s'
        result = db_operation(query, [email], fetch_one=True)
        print(f"[DEBUG] User query result: {result}")

        if result:
            print(f"[DEBUG] Raw result from database: {result}")
            # Handle workspaces field
            if 'workspaces' in result and result['workspaces']:
                try:
                    if isinstance(result['workspaces'], str):
                        result['workspaces'] = json.loads(result['workspaces'])
                    else:
                        result['workspaces'] = result['workspaces']
                except Exception as e:
                    print(f"[DEBUG] Error parsing workspaces JSON: {e}")
                    result['workspaces'] = []
            else:
                result['workspaces'] = []

            # Handle anchor_answers field
            if 'anchor_answers' in result and result['anchor_answers']:
                try:
                    if isinstance(result['anchor_answers'], str):
                        result['anchor_answers'] = json.loads(result['anchor_answers'])
                    else:
                        result['anchor_answers'] = result['anchor_answers']
                except Exception as e:
                    print(f"[DEBUG] Error parsing anchor_answers JSON: {e}")
                    result['anchor_answers'] = {}
            else:
                result['anchor_answers'] = {}

            print(f"[DEBUG] Final user data to return: {result}")
            return jsonify(result)
        else:
            print(f"[DEBUG] No user found with email: {email}")
            return jsonify({})
    except Exception as e:
        print(f"[DEBUG] Error in get_user_by_email: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/users/id/<user_id>', methods=['GET'])
def get_user_by_id(user_id):
    print(f"[DEBUG] Getting user by ID: {user_id}")
    try:
        # First check if the table exists
        table_check = db_operation("SHOW TABLES LIKE 'users_updated'", fetch_one=True)
        print(f"[DEBUG] Table check result: {table_check}")

        if not table_check:
            print("[DEBUG] users_updated table does not exist!")
            return jsonify({"error": "Table does not exist"}), 500

        # Get the specific user by ID
        query = 'SELECT * FROM users_updated WHERE id = %s'
        result = db_operation(query, [user_id], fetch_one=True)
        print(f"[DEBUG] User query result: {result}")

        if result:
            print(f"[DEBUG] Raw result from database: {result}")
            # Handle workspaces field
            if 'workspaces' in result and result['workspaces']:
                try:
                    if isinstance(result['workspaces'], str):
                        result['workspaces'] = json.loads(result['workspaces'])
                    else:
                        result['workspaces'] = result['workspaces']
                except Exception as e:
                    print(f"[DEBUG] Error parsing workspaces JSON: {e}")
                    result['workspaces'] = []
            else:
                result['workspaces'] = []

            # Handle anchor_answers field
            if 'anchor_answers' in result and result['anchor_answers']:
                try:
                    if isinstance(result['anchor_answers'], str):
                        result['anchor_answers'] = json.loads(result['anchor_answers'])
                    else:
                        result['anchor_answers'] = result['anchor_answers']
                except Exception as e:
                    print(f"[DEBUG] Error parsing anchor_answers JSON: {e}")
                    result['anchor_answers'] = {}
            else:
                result['anchor_answers'] = {}

            print(f"[DEBUG] Final user data to return: {result}")
            return jsonify(result)
        else:
            print(f"[DEBUG] No user found with ID: {user_id}")
            return jsonify({})
    except Exception as e:
        print(f"[DEBUG] Error in get_user_by_id: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/users', methods=['POST'])
def create_user():
    data = request.json
    email = data['email']
    name = data['name']
    role = data.get('role', 'user')

    print(f"[DEBUG] Creating user: email={email}, name={name}, role={role}")

    # Generate a unique ID
    import uuid
    user_id = str(uuid.uuid4())
    print(f"[DEBUG] Generated user ID: {user_id}")

    try:
        query = '''
            INSERT INTO users_updated (id, name, email, role)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            role = VALUES(role),
            updated_at = CURRENT_TIMESTAMP
        '''
        result = db_operation(query, [user_id, name, email, role])
        print(f"[DEBUG] User creation result: {result}")

        # Return the created user data instead of just success
        if result:
            user = db_operation('SELECT * FROM users_updated WHERE email = %s', [email], fetch_one=True)
            print(f"[DEBUG] Created user data: {user}")
            return jsonify({"success": True, "user": user})
        else:
            print(f"[DEBUG] User creation failed")
            return jsonify({"success": False, "error": "Failed to create user"})
    except Exception as e:
        print(f"[DEBUG] Exception in user creation: {e}")
        return jsonify({"success": False, "error": str(e)})

# Get all responses (keeping original table for Slack data)
@app.route('/responses', methods=['GET'])
def get_all_responses():
    query = '''
    SELECT r.*, u.username, u.status
    FROM responses r
    LEFT JOIN users u ON r.user_id = u.id
    ORDER BY r.submission_time DESC
    '''
    result = db_operation(query, fetch_all=True)
    return jsonify(result if result else [])

# Get response by ID
@app.route('/responses/<int:response_id>', methods=['GET'])
def get_response_by_id(response_id):
    query = '''
    SELECT r.*, u.username, u.status
    FROM responses r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.response_id = %s
    '''
    result = db_operation(query, [response_id], fetch_one=True)
    return jsonify(result if result else {})

# Get new responses since last call
@app.route('/responses/new', methods=['GET'])
def get_new_responses():
    last_time = get_latest_query_time()
    query = '''
    SELECT r.*, u.username, u.status
    FROM responses r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.submission_time IS NOT NULL
    '''

    if last_time:
        query += ' AND r.submission_time > %s'
        result = db_operation(query, [last_time], fetch_all=True)
    else:
        result = db_operation(query, fetch_all=True)

    append_latest_query_time()
    return jsonify(result if result else [])

# iOS App specific endpoints
@app.route('/workspaces', methods=['GET'])
def get_workspaces():
    query = 'SELECT * FROM workspaces ORDER BY created_at DESC'
    result = db_operation(query, fetch_all=True)
    return jsonify({"workspaces": result if result else []})

@app.route('/workspaces', methods=['POST'])
def create_workspace():
    data = request.json
    # Fetch developer id by email
    dev_email = data.get('developer', '')
    dev_id = None
    if dev_email:
        dev_query = 'SELECT id FROM users_updated WHERE email = %s'
        dev_result = db_operation(dev_query, [dev_email], fetch_one=True)
        if dev_result:
            dev_id = dev_result['id']
    developer_value = dev_id if dev_id else dev_email
    import json

    # Add mandatory dropdown question to the beginning of the questions list
    area_question = {
        "text": "Which general area on campus are you reporting from?",
        "type": "dropdown",
        "options": [
            "Cazenove",
            "Pomeroy",
            "Shafer",
            "Beebe",
            "Bates",
            "McAfee",
            "Freeman",
            "Stone Davis",
            "Tower Court",
            "Tower Court",
            "Claflin",
            "Lake House",
            "Severance",
            "Dower House",
            "Weaver House (Admission Office)",
            "Houghton Chapel",
            "Pendleton Hall",
            "Jewett Arts Center",
            "Green Hall",
            "Founders Hall",
            "Davis Museum",
            "Clapp Library",
            "Science Center",
            "Global Flora",
            "Whitin Observatory",
            "Modular Units",
            "Lulu Chow Wang Campus Center",
            "Keohane Sports Center",
            "Acorns",
            "Billings",
            "Harambee House",
            "Slater House",
            "On the Local Motion",
            "Chapel bus stop",
            "Founders bus stop",
            "TZE House",
            "ZA House",
            "French House",
            "Casa Cervantes",
            "Diana Chapman Walsh Alumnae Hall",
            "Stone Health Center"
        ]
    }
    questions = data.get('questions', [])
    # Always enforce the dropdown for the area question
    if questions and questions[0].get('text') == area_question['text']:
        questions[0] = area_question
    else:
        questions = [area_question] + questions

    # Get main question and main data type from request data
    main_question = data.get('main_question', '')
    main_data_type = data.get('main_data_type', '')
    print(f"[DEBUG] Workspace creation - main_question: '{main_question}', main_data_type: '{main_data_type}'")

    # Insert main question after area question if not already present
    if main_question:
        # Check if main question is already in questions (by text)
        found = any(q['text'] == main_question for q in questions)
        if not found and main_question != area_question['text']:
            # Insert as second question
            questions = [questions[0], {"text": main_question, "type": "text"}] + questions[1:]
        elif found:
            # Move main question to second position if not area question
            idx = next((i for i, q in enumerate(questions) if q['text'] == main_question), None)
            if idx is not None and idx != 1 and main_question != area_question['text']:
                q = questions.pop(idx)
                questions = [questions[0], q] + questions[1:]
    questions_json = json.dumps(questions)

    anchor_question = data.get('anchor_question', '')
    query = '''
        INSERT INTO workspaces (id, name, description, developer, questions, main_question, anchor_question, main_data_type)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    '''
    workspace_result = db_operation(query, [
        data['id'],
        data['name'],
        data.get('description', ''),
        developer_value,
        questions_json,
        main_question,
        anchor_question,
        main_data_type
    ])
    if workspace_result:
        print(f"[DEBUG] Workspace created successfully with main question: '{main_question}'")
        table_result = create_workspace_response_table(data['id'], questions)
        if table_result:
            return jsonify({
                "success": True,
                "data": data,
                "message": f"Workspace created and response table 'workspace_{data['id']}_responses' created successfully"
            })
        else:
            return jsonify({
                "success": False,
                "error": "Workspace created but failed to create response table"
            })
    else:
        return jsonify({
            "success": False,
            "error": "Failed to create workspace"
        })

@app.route('/workspaces/<workspace_id>', methods=['GET'])
def get_workspace(workspace_id):
    query = 'SELECT * FROM workspaces WHERE id = %s'
    result = db_operation(query, [workspace_id], fetch_one=True)
    if result:
        # Ensure questions is always a list
        import json
        questions = result.get('questions')
        if isinstance(questions, str):
            try:
                result['questions'] = json.loads(questions)
            except Exception:
                result['questions'] = []
        elif not isinstance(questions, list):
            result['questions'] = []
        return jsonify(result)
    else:
        return jsonify({'error': 'Workspace not found'}), 404

@app.route('/responses/<workspace_id>', methods=['GET'])
def get_responses_by_workspace(workspace_id):
    table_name = f"workspace_{workspace_id}_responses"
    query = f'''
        SELECT * FROM {table_name}
        ORDER BY time_task_created DESC
    '''
    result = db_operation(query, fetch_all=True)

    return jsonify({"responses": result if result else []})

@app.route('/responses/<workspace_id>', methods=['POST'])
def add_response(workspace_id):
    data = request.json
    responses = data if isinstance(data, list) else [data]
    # Fetch questions for this workspace
    workspace_query = 'SELECT questions FROM workspaces WHERE id = %s'
    workspace = db_operation(workspace_query, [workspace_id], fetch_one=True)
    import json
    from datetime import datetime
    questions = json.loads(workspace['questions']) if workspace and 'questions' in workspace else []
    table_name = f"workspace_{workspace_id}_responses"
    for response in responses:
        # Convert ISO timestamp to MySQL datetime format
        timestamp_str = response.get('timestamp')
        if timestamp_str:
            try:
                # Parse ISO string and convert to MySQL datetime format
                dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                mysql_timestamp = dt.strftime('%Y-%m-%d %H:%M:%S')
            except:
                # Fallback to current timestamp if parsing fails
                mysql_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        else:
            mysql_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        columns = ['user_id', 'time_completed', 'latitude', 'longitude']
        values = [
            response.get('user_id', 'unknown'),  # Include user_id
            mysql_timestamp,  # This is when the user completed/submitted the form
            response.get('coordinates', {}).get('latitude'),
            response.get('coordinates', {}).get('longitude')
        ]
        for idx, q in enumerate(questions):
            col = sanitize_column_name(q['text'])
            columns.append(f"`{col}`")
            values.append(response['answers'][idx] if idx < len(response['answers']) else None)
        placeholders = ', '.join(['%s'] * len(values))
        query = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
        db_operation(query, values)
    return jsonify({"success": True})

@app.route('/tasks/<workspace_id>/<user_id>', methods=['GET'])
def get_user_tasks(workspace_id, user_id):
    table_name = f"workspace_{workspace_id}_responses"
    query = f'''
        SELECT t.*, w.name as workspace_name
        FROM {table_name} t
        JOIN workspaces w ON w.id = %s
        WHERE t.user_id = %s
    '''
    result = db_operation(query, [workspace_id, user_id], fetch_all=True)
    return jsonify({"tasks": result if result else []})

@app.route('/tasks/<workspace_id>/<task_id>/accept', methods=['POST'])
def accept_task(workspace_id, task_id):
    table_name = f"workspace_{workspace_id}_responses"
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    query = f"UPDATE {table_name} SET time_task_responded = %s, task_status = %s WHERE id = %s"
    result = db_operation(query, [now, 'accepted', task_id])
    return jsonify({"success": result})

@app.route('/tasks/<workspace_id>/<task_id>/decline', methods=['POST'])
def decline_task(workspace_id, task_id):
    table_name = f"workspace_{workspace_id}_responses"
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    query = f"UPDATE {table_name} SET time_task_responded = %s, task_status = %s WHERE id = %s"
    result = db_operation(query, [now, 'declined', task_id])
    return jsonify({"success": result})

@app.route('/tasks/<workspace_id>/<task_id>/complete', methods=['POST'])
def complete_task(workspace_id, task_id):
    data = request.json or {}
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    answers = data.get('answers', [])
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    table_name = f"workspace_{workspace_id}_responses"

    # Fetch questions to know which columns to update
    workspace = db_operation('SELECT questions FROM workspaces WHERE id = %s', [workspace_id], fetch_one=True)
    import json
    questions = json.loads(workspace['questions']) if workspace and 'questions' in workspace else []

    # Build SET clause for answers, skipping the general area column
    set_clauses = ["time_completed = %s", "task_status = %s"]
    values = [now, 'completed']
    if latitude is not None:
        set_clauses.append("latitude = %s")
        values.append(latitude)
    if longitude is not None:
        set_clauses.append("longitude = %s")
        values.append(longitude)
    answer_idx = 0
    for q in questions:
        if q['text'] == 'Which general area on campus are you reporting from?':
            continue  # Do not update this column
        col = sanitize_column_name(q['text'])
        if answer_idx < len(answers):
            set_clauses.append(f"`{col}` = %s")
            values.append(answers[answer_idx])
            answer_idx += 1
    values.append(task_id)
    set_clause = ", ".join(set_clauses)
    query = f"UPDATE {table_name} SET {set_clause} WHERE id = %s"
    result = db_operation(query, values)
    return jsonify({"success": result})

@app.route('/users/<user_id>/join_workspace', methods=['POST'])
def join_workspace(user_id):
    data = request.json
    workspace_id = data.get('workspace_id')
    if not workspace_id:
        return jsonify({'success': False, 'error': 'Missing workspace_id'}), 400

    # Save anchor question answer if provided
    anchor_answer = data.get('anchor_answer')
    if anchor_answer:
        try:
            # Get current user data including existing anchor answers
            user_query = 'SELECT workspaces, anchor_answers FROM users_updated WHERE id = %s'
            user_result = db_operation(user_query, [user_id], fetch_one=True)

            if not user_result:
                return jsonify({'success': False, 'error': 'User not found'}), 404

            # Parse existing workspaces and anchor answers
            workspaces = []
            anchor_answers = {}

            if user_result.get('workspaces'):
                try:
                    if isinstance(user_result['workspaces'], str):
                        workspaces = json.loads(user_result['workspaces'])
                    else:
                        workspaces = user_result['workspaces']
                except Exception:
                    workspaces = []

            if user_result.get('anchor_answers'):
                try:
                    if isinstance(user_result['anchor_answers'], str):
                        anchor_answers = json.loads(user_result['anchor_answers'])
                    else:
                        anchor_answers = user_result['anchor_answers']
                except Exception:
                    anchor_answers = {}

            # Add the new anchor answer
            anchor_answers[workspace_id] = anchor_answer

            # Update user with new anchor answers
            update_query = 'UPDATE users_updated SET anchor_answers = %s WHERE id = %s'
            result = db_operation(update_query, [json.dumps(anchor_answers), user_id])

            if result:
                print(f"[AnchorAnswer] Successfully saved anchor answer for user {user_id} in workspace {workspace_id}")
            else:
                print(f"[AnchorAnswer] Failed to save anchor answer for user {user_id}")

        except Exception as e:
            print(f"[AnchorAnswer] Error saving anchor answer: {e}")
            # Continue with workspace join even if anchor answer fails

    # Fetch current workspaces
    user = db_operation('SELECT workspaces FROM users_updated WHERE id = %s', [user_id], fetch_one=True)
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404

    workspaces = []
    if user.get('workspaces'):
        try:
            workspaces = json.loads(user['workspaces'])
        except:
            workspaces = []

    if workspace_id not in workspaces:
        workspaces.append(workspace_id)
        # Save updated workspaces
        db_operation('UPDATE users_updated SET workspaces = %s WHERE id = %s', [json.dumps(workspaces), user_id])

    return jsonify({'success': True, 'message': 'Successfully joined workspace'})

@app.route('/workspaces/<workspace_id>/anchor-question', methods=['GET'])
def get_workspace_anchor_question(workspace_id):
    query = 'SELECT name, anchor_question, main_data_type FROM workspaces WHERE id = %s'
    result = db_operation(query, [workspace_id], fetch_one=True)
    if result:
        return jsonify({
            'workspace_name': result['name'],
            'anchor_question': result.get('anchor_question', ''),
            'main_data_type': result.get('main_data_type', '')
        })
    else:
        return jsonify({'error': 'Workspace not found'}), 404

@app.route('/users/<user_id>/anchor-answers', methods=['GET'])
def get_user_anchor_answers(user_id):
    try:
        # Get user's anchor answers from the JSON field
        query = 'SELECT anchor_answers FROM users_updated WHERE id = %s'
        result = db_operation(query, [user_id], fetch_one=True)

        if not result:
            return jsonify({'anchor_answers': {}})

        # Parse anchor answers JSON
        anchor_answers = {}
        if result.get('anchor_answers'):
            try:
                if isinstance(result['anchor_answers'], str):
                    anchor_answers = json.loads(result['anchor_answers'])
                else:
                    anchor_answers = result['anchor_answers']
            except Exception:
                anchor_answers = {}

        return jsonify({'anchor_answers': anchor_answers})
    except Exception as e:
        print(f"[AnchorAnswer] Error getting anchor answers: {e}")
        return jsonify({'error': 'Failed to get anchor answers'}), 500

@app.route('/format-answers', methods=['POST'])
def format_answers():
    data = request.json
    text = data.get('text', '')
    main_data_type = data.get('main_data_type', '')

    print(f"[DEBUG] Format answers endpoint called with text: '{text}', main_data_type: '{main_data_type}'")

    if not text or len(text.strip()) < 5:
        print(f"[DEBUG] Text too short, returning as is")
        return jsonify({'formatted_text': text})

    try:
        from gemini import format_answers_api
        print(f"[DEBUG] Calling Gemini format_answers_api")
        result = format_answers_api(text, main_data_type)
        print(f"[DEBUG] Gemini result: {result}")
        return jsonify(result)
    except Exception as e:
        print(f"[FormatAnswers] Error: {e}")
        return jsonify({'formatted_text': text})

@app.route('/check-typo', methods=['POST'])
def check_typo():
    """Check for typos in text using modular Gemini API"""
    try:
        data = request.json
        text = data.get('text', '')

        if not text or len(text.strip()) < 3:
            return jsonify({'suggestions': [], 'has_typos': False})

        # Use the modular Gemini typo checker
        from gemini import check_typo_api
        result = check_typo_api(text)

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/check-typo/stats', methods=['GET'])
def get_typo_stats():
    """Get typo checker cache statistics"""
    try:
        from gemini import get_cache_stats
        return jsonify(get_cache_stats())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/check-typo/clear-cache', methods=['POST'])
def clear_typo_cache():
    """Clear the typo checker cache"""
    try:
        from gemini import clear_cache
        clear_cache()
        return jsonify({'success': True, 'message': 'Cache cleared'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/check-typo/reset-counter', methods=['POST'])
def reset_typo_counter():
    """Reset the daily API call counter (for testing)"""
    try:
        from gemini import reset_daily_counter
        reset_daily_counter()
        return jsonify({'success': True, 'message': 'Daily counter reset'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# COMMENTED OUT - Sentiment analysis removed for proximity-only approach
# @app.route('/format-answers-sentiment', methods=['POST'])
# def format_answers_sentiment():
#     """Format answers using sentiment analysis instead of Gemini"""
#     try:
#         data = request.json
#         text = data.get('text', '')
#         main_data_type = data.get('main_data_type', '')
#
#         print(f"[DEBUG] Sentiment format_answers called with text: '{text}', main_data_type: '{main_data_type}'")
#
#         if not text:
#             return jsonify({'formatted_text': '', 'error': 'No text provided'})
#
#         # Use ML-based sentiment analysis to extract and format entities
#         entities = sentiment_analyzer.extract_entities_ml(text)
#
#         # Calculate comprehensive ML-based scores
#         comprehensive_scores = sentiment_analyzer.calculate_comprehensive_score(text)
#
#         # Format entities as comma-separated list
#         entity_names = [entity['entity'] for entity in entities] if entities else []
#         formatted_text = ', '.join(entity_names) if entity_names else text
#
#         result = {
#             'formatted_text': formatted_text,
#             'entities': entities,
#             'comprehensive_scores': comprehensive_scores,
#             'method': 'ml_sentiment_analysis'
#         }
#
#         print(f"[DEBUG] Sentiment format_answers result: {result}")
#         return jsonify(result)
#
#     except Exception as e:
#         print(f"[DEBUG] Error in sentiment format_answers: {e}")
#         return jsonify({
#             'formatted_text': text,
#             'error': str(e),
#             'method': 'sentiment_analysis_fallback'
#         })

# COMMENTED OUT - Sentiment analysis removed for proximity-only approach
# @app.route('/assign-tasks-sentiment', methods=['POST'])
# def assign_tasks_sentiment():
#     """Manually trigger sentiment-based task assignment"""
#     try:
#         print("[DEBUG] Manual sentiment task assignment triggered")
#
#         # Import the integrated task assignment module
#         import task_assignment
#
#         # Trigger sentiment-based assignment
#         task_assignment.run_sentiment_based_assignment()
#
#         return jsonify({
#             'success': True,
#             'message': 'Sentiment-based task assignment completed',
#             'method': 'sentiment_analysis'
#         })
#     except Exception as e:
#         print(f"[DEBUG] Error in manual sentiment task assignment: {e}")
#         return jsonify({
#             'success': False,
#             'error': str(e),
#             'method': 'sentiment_analysis'
#         }), 500

# Start server
if __name__ == "__main__":
    # Initialize the latest query time file if it doesn't exist
    if not os.path.exists('latest_query_time.txt'):
        with open('latest_query_time.txt', 'w') as f:
            pass

    # Get SSL certificate paths from environment variables or use defaults
    CERT_PATH = os.environ.get('SSL_CERT_PATH', 'cert.pem')
    KEY_PATH = os.environ.get('SSL_KEY_PATH', 'key.pem')

    # Simple HTTP server for development (port configurable via env)
    port_str = os.environ.get('PORT', '5000')
    try:
        port = int(port_str)
    except ValueError:
        port = 5000
    print(f"Starting server with HTTP on port {port}")
    app.run(debug=True, host='0.0.0.0', port=port)
