import json
import os
import re
import secrets
import smtplib
import ssl
import threading
import time
import traceback
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from pathlib import Path

import pymysql
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from database_utils import db_operation

# from sentiment_analysis import sentiment_analyzer  # COMMENTED OUT - Using proximity only

env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

# Initialize Flask
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# In-memory OTP store for demo/testing in Expo Go. For production, use Redis/DB.
# Structure: { email_lower: { code: str, issued_at: int, used: bool } }
otp_store = {}
OTP_TTL_SECONDS = 300  # 5 minutes
OTP_LENGTH = 6

# SMTP configuration (set via environment). Defaults are safe no-ops.
SMTP_HOST = os.environ.get('SMTP_HOST', '')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASS = os.environ.get('SMTP_PASS', '')
FROM_EMAIL = os.environ.get('FROM_EMAIL', 'hn103@wellesley.edu')

# OTP/dev configuration
EXPOSE_OTP_IN_RESPONSE = os.environ.get('EXPOSE_OTP_IN_RESPONSE', '1') == '1'
BYPASS_OTP_RATE_LIMIT = os.environ.get('BYPASS_OTP_RATE_LIMIT', '1') == '1'
SMTP_DEBUG = os.environ.get('SMTP_DEBUG', '0') == '1'
SMTP_LAST_ERROR = None

def send_otp_email(to_email: str, code: str) -> bool:
    """Send OTP email via SMTP if configured; return True on best-effort success.
    If SMTP is not configured, return False so caller can log fallback.
    """
    try:
        if not SMTP_HOST or not FROM_EMAIL:
            return False
        subject = "Your Lexi verification code"
        body = (
            f"Hi from Lexi! Your verification code is {code}. It expires in 5 minutes. "
            f"If you didn't request this, please ignore this email and contact hn103@wellesley.edu! Thank you!"
        )
        msg = MIMEText(body)
        msg['Subject'] = subject
        msg['From'] = FROM_EMAIL
        msg['To'] = to_email

        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            if SMTP_DEBUG:
                server.set_debuglevel(1)
            server.ehlo()
            try:
                server.starttls(context=context)
                server.ehlo()
            except Exception:
                pass  # Some servers may not require/start TLS
            if SMTP_USER and SMTP_PASS:
                server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(FROM_EMAIL, [to_email], msg.as_string())
        return True
    except Exception as e:
        global SMTP_LAST_ERROR
        SMTP_LAST_ERROR = str(e)
        print(f"[OTP] Email send failed for {to_email}: {e}")
        return False

def create_workspace_response_table(*_args, **_kwargs):
    # Legacy no-op kept for backward compatibility
    return True

##########################
# New simplified Lexi schema
##########################

# Allowed campus areas (categorical question)
LEXI_AREAS = [
    "The Quint (Beebe, Cazenove, Pomeroy, Shafer, Munger)",
    "East Side (Bates, Freeman, McAfee)",
    "Stone Davis",
    "Tower Court (East, West, Claflin, Severance)",
    "Academic Quad (Green, Founders, PNE/PNW, Jewett)",
    "Science Center",
    "Modular Units",
    "Lulu Chow Wang Campus Center",
    "Keohane Sports Center (KSC)",
    "Acorns",
    "Billings",
    "Harambee House",
    "Slater House",
    "Lake House",
    "On the Local Motion (‘What time do you take the bus?’)",
    "Bus stops (Chapel, Lulu, Founders)",
    "Shakespeare Houses",
    "TZE House",
    "ZA House",
    "French House",
    "Casa Cervantes",
    "Other",
]

# Determination methods options (checkbox list)
LEXI_DETERMINATION_OPTIONS = [
    "I am a speaker of this language",
    "I’ve heard this language online or in media (movies, TV, music, etc.)",
    "My family speaks this language",
    "I’m currently learning this language",
    "My friends use this language",
    "I know a language in the same family (eg. romance)",
    "Other",
]


def add_column_if_missing(table: str, column: str, definition: str):
    try:
        exists = db_operation(f"SHOW COLUMNS FROM {table} LIKE %s", [column], fetch_one=True)
        if not exists:
            db_operation(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
    except Exception:
        pass


def create_lexi_tables():
    """Create simplified Lexi tables: users_lexi and lexi."""
    users_table = (
        """
        CREATE TABLE IF NOT EXISTS users_lexi (
            user_id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            anchor_answer JSON,
            consent_given TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    responses_table = (
        """
        CREATE TABLE IF NOT EXISTS lexi (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            general_area VARCHAR(255) NOT NULL,
            specific_location TEXT NOT NULL,
            language_spoken VARCHAR(255) NOT NULL,
            num_speakers INT NOT NULL,
            was_part_of_conversation TINYINT(1) NOT NULL,
            followup_details TEXT,
            comfortable_to_ask_more ENUM('Yes','No','I don\'t know') NULL,
            go_up_to_speakers ENUM('Yes','No','I don\'t know') NULL,
            determination_methods JSON NOT NULL,
            determination_other_text TEXT,
            latitude DECIMAL(10, 8) NULL,
            longitude DECIMAL(11, 8) NULL,
            CONSTRAINT fk_lexi_user FOREIGN KEY (user_id) REFERENCES users_lexi(user_id)
        )
        """
    )
    ok1 = db_operation(users_table)
    ok2 = db_operation(responses_table)
    # Ensure consent_given exists for older deployments
    add_column_if_missing('users_lexi', 'consent_given', "TINYINT(1) DEFAULT 0")
    # Migrate optional follow-up columns on lexi (MySQL 5.7-safe)
    add_column_if_missing('lexi', 'go_up_to_speakers', "ENUM('Yes','No','I don't know') NULL")
    add_column_if_missing('lexi', 'speaker_said_audio_url', 'TEXT NULL')
    add_column_if_missing('lexi', 'speaker_origin', 'TEXT NULL')
    add_column_if_missing('lexi', 'speaker_cultural_background', 'TEXT NULL')
    add_column_if_missing('lexi', 'speaker_dialect', 'TEXT NULL')
    add_column_if_missing('lexi', 'speaker_context', 'TEXT NULL')
    add_column_if_missing('lexi', 'speaker_proficiency', 'VARCHAR(255) NULL')
    add_column_if_missing('lexi', 'speaker_gender_identity', "ENUM('Female','Male','Transgender','Non-binary / Gender nonconforming','Prefer not to say','Other') NULL")
    add_column_if_missing('lexi', 'speaker_gender_other_text', 'TEXT NULL')
    add_column_if_missing('lexi', 'speaker_academic_level', "ENUM('Freshman','Sophomore','Junior','Senior','Davis Scholar','Faculty/Staff','Pre-college','Non Wellesley-affiliated adult') NULL")
    add_column_if_missing('lexi', 'additional_comments', 'TEXT NULL')
    add_column_if_missing('lexi', 'outstanding_questions', 'TEXT NULL')
    return ok1 and ok2


@app.route('/create-lexi-tables', methods=['POST'])
def create_lexi_tables_route():
    try:
        created = create_lexi_tables()
        return jsonify({"success": bool(created)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

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
    # Simplified mode: task system disabled
    return

# Initialize task system
# initialize_task_system()  # Disabled in simplified mode

''' Routes '''
# Testing endpoint
@app.route("/test", methods=['GET'])
def hello():
    return jsonify({
        "message": "Hello from Flask server!",
        "timestamp": datetime.now().isoformat(),
        "server_info": "HTTP on port 5000"
    })
@app.route('/auth/request-code', methods=['POST'])
def request_code():
    try:
        data = request.json or {}
        email = (data.get('email') or '').strip().lower()
        if not email or '@' not in email:
            return jsonify({'success': False, 'error': 'Invalid email'}), 400

        # Always generate a fresh OTP and overwrite previous one
        now = int(time.time())
        code = f"{secrets.randbelow(10**OTP_LENGTH):0{OTP_LENGTH}d}"
        # Store only the latest code for this email
        otp_store[email] = { 'code': code, 'issued_at': now, 'used': False }

        # Log request and code for development visibility
        print(f"[OTP] Request received for {email}")
        print(f"[OTP] Code for {email}: {code}")

        # Try to send email (best effort). Even if SMTP fails, allow client to proceed.
        mailed = send_otp_email(email, code)
        msg = 'Verification code sent' if mailed else 'Code generated (check server logs); email delivery not configured'

        payload = {'success': True, 'message': msg}
        if EXPOSE_OTP_IN_RESPONSE:
            payload['dev_code'] = code
            if not mailed and SMTP_LAST_ERROR:
                payload['smtp_error'] = SMTP_LAST_ERROR
        return jsonify(payload)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/auth/verify-code', methods=['POST'])
def verify_code():
    try:
        data = request.json or {}
        email = (data.get('email') or '').strip().lower()
        code = (data.get('code') or '').strip()
        # Normalize to digits only to avoid stray characters from mobile keyboards
        try:
            code = re.sub(r'\D', '', code)
        except Exception:
            pass
        if not email or not code:
            # Return 200 with success:false for better client UX (avoid fetch throwing on 4xx)
            payload = {'success': False, 'error': 'Missing email or code'}
            if EXPOSE_OTP_IN_RESPONSE:
                payload['dev_reason'] = 'missing_parameters'
            return jsonify(payload), 200

        record = otp_store.get(email)
        if not record:
            payload = {'success': False, 'error': 'Code not found'}
            if EXPOSE_OTP_IN_RESPONSE:
                payload['dev_reason'] = 'no_record_for_email'
            return jsonify(payload), 200

        # Validate against single latest record
        now = int(time.time())
        stored_code = str(record.get('code', ''))
        stored_issued_at = int(record.get('issued_at', 0))
        stored_used = bool(record.get('used', False))

        if stored_used:
            payload = {'success': False, 'error': 'Code already used'}
            if EXPOSE_OTP_IN_RESPONSE:
                payload['dev_reason'] = 'used_flag_set'
            return jsonify(payload), 200

        if now - stored_issued_at > OTP_TTL_SECONDS:
            payload = {'success': False, 'error': 'Code expired'}
            if EXPOSE_OTP_IN_RESPONSE:
                payload['dev_reason'] = 'expired_latest'
            return jsonify(payload), 200

        if stored_code != code:
            payload = {'success': False, 'error': 'Invalid code'}
            if EXPOSE_OTP_IN_RESPONSE:
                payload['dev_reason'] = 'mismatch_latest'
                payload['dev_latest'] = stored_code
            return jsonify(payload), 200

        # Mark used and persist
        otp_store[email] = { 'code': stored_code, 'issued_at': stored_issued_at, 'used': True }
        try:
            print(f"[OTP] Verified for {email}. code={stored_code}")
        except Exception:
            pass

        # Look up existing user only in users_lexi
        lexi_user = db_operation('SELECT * FROM users_lexi WHERE email = %s', [email], fetch_one=True)
        if not lexi_user:
            return jsonify({'success': True, 'needs_profile': True, 'email': email})
        session = {
            'id': lexi_user['user_id'],
            'email': lexi_user['email'],
            'name': lexi_user['name'],
            'role': 'user',
            'consent_given': int(lexi_user.get('consent_given', 0))
        }
        return jsonify({'success': True, 'user': session})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route("/test-users", methods=['GET'])
def test_users():
    try:
        table_exists = db_operation("SHOW TABLES LIKE 'users_lexi'", fetch_one=True)
        if not table_exists:
            return jsonify({
                "error": "users_lexi table does not exist",
                "timestamp": datetime.now().isoformat()
            })
        users = db_operation("SELECT user_id, name, email, created_at FROM users_lexi", fetch_all=True) or []
        return jsonify({
            "table_exists": True,
            "user_count": len(users),
            "users": users,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e), "timestamp": datetime.now().isoformat()}), 500

@app.route("/test-db", methods=['GET'])
def test_db():
    try:
        users_table = db_operation("SHOW TABLES LIKE 'users_lexi'", fetch_one=True)
        responses_table = db_operation("SHOW TABLES LIKE 'lexi'", fetch_one=True)
        user_count = 0
        if users_table:
            result = db_operation("SELECT COUNT(*) as cnt FROM users_lexi", fetch_one=True)
            user_count = (result or {}).get('cnt', 0)
        return jsonify({
            "users_lexi_exists": users_table is not None,
            "lexi_exists": responses_table is not None,
            "user_count": user_count,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e), "timestamp": datetime.now().isoformat()}), 500

@app.route("/create-tables", methods=['POST'])
def create_tables():
    try:
        created = create_lexi_tables()
        return jsonify({"success": bool(created)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# /task-status disabled in simplified mode

@app.route('/users', methods=['GET'])
def get_users():
    query = 'SELECT user_id as id, name, email, anchor_answer, consent_given, created_at FROM users_lexi ORDER BY created_at DESC'
    rows = db_operation(query, fetch_all=True) or []
    for u in rows:
        try:
            if isinstance(u.get('anchor_answer'), str):
                u['anchor_answer'] = json.loads(u['anchor_answer'])
        except Exception:
            u['anchor_answer'] = []
    return jsonify(rows)

@app.route('/users/<email>', methods=['GET'])
def get_user_by_email(email):
    print(f"[DEBUG] Getting user by email: {email}")
    try:
        # Get the specific user from users_lexi
        result = db_operation('SELECT user_id as id, name, email, anchor_answer, consent_given, created_at FROM users_lexi WHERE email = %s', [email], fetch_one=True)
        print(f"[DEBUG] User query result: {result}")

        if result:
            print(f"[DEBUG] Raw result from database: {result}")
            if 'anchor_answer' in result and result['anchor_answer']:
                try:
                    if isinstance(result['anchor_answer'], str):
                        result['anchor_answer'] = json.loads(result['anchor_answer'])
                except Exception as e:
                    print(f"[DEBUG] Error parsing anchor_answer JSON: {e}")
                    result['anchor_answer'] = []

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
        result = db_operation('SELECT user_id as id, name, email, anchor_answer, consent_given, created_at FROM users_lexi WHERE user_id = %s', [user_id], fetch_one=True)
        print(f"[DEBUG] User query result: {result}")

        if result:
            print(f"[DEBUG] Raw result from database: {result}")
            if 'anchor_answer' in result and result['anchor_answer']:
                try:
                    if isinstance(result['anchor_answer'], str):
                        result['anchor_answer'] = json.loads(result['anchor_answer'])
                except Exception as e:
                    print(f"[DEBUG] Error parsing anchor_answer JSON: {e}")
                    result['anchor_answer'] = []

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
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    name = (data.get('name') or '').strip()
    consent = bool(data.get('consent') or False)
    anchor_answer_payload = data.get('anchor_answer')

    if not email or not name:
        return jsonify({"success": False, "error": "Missing name or email"}), 400

    print(f"[DEBUG] Creating first-time user: email={email}, name={name}")

    import json as _json
    import uuid
    user_id = str(uuid.uuid4())

    try:
        # Ensure simplified tables exist
        create_lexi_tables()

        # Create in users_lexi
        insert_lexi = '''
            INSERT INTO users_lexi (user_id, name, email, anchor_answer, consent_given)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
            name = VALUES(name),
                anchor_answer = VALUES(anchor_answer),
                consent_given = VALUES(consent_given),
                created_at = created_at
        '''
        if anchor_answer_payload is None:
            anchor_answer_json = _json.dumps([])
        else:
            if not isinstance(anchor_answer_payload, list):
                return jsonify({"success": False, "error": "anchor_answer must be array of strings"}), 400
            anchor_answer_json = _json.dumps(anchor_answer_payload)
        result_lexi = db_operation(insert_lexi, [user_id, name, email, anchor_answer_json, 1 if consent else 0])

        if result_lexi:
            user = db_operation('SELECT * FROM users_lexi WHERE email = %s', [email], fetch_one=True)
            if user:
                session = {
                    'id': user['user_id'],
                    'email': user['email'],
                    'name': user['name'],
                    'role': 'user',
                    'consent_given': int(user.get('consent_given', 0))
                }
                return jsonify({"success": True, "user": session})
            return jsonify({"success": False, "error": "Failed to create user"})
    except Exception as e:
        print(f"[DEBUG] Exception in user creation: {e}")
        return jsonify({"success": False, "error": str(e)})

# Legacy responses endpoints disabled in simplified mode

# Legacy workspace endpoints removed in simplified schema


# New simplified endpoints for Lexi responses
@app.route('/lexi/responses', methods=['POST'])
def create_lexi_response():
    try:
        create_lexi_tables()
        data = request.json or {}

        # Required fields
        user_id = (data.get('user_id') or '').strip()
        general_area = (data.get('general_area') or '').strip()
        specific_location = (data.get('specific_location') or '').strip()
        language_spoken = (data.get('language_spoken') or '').strip()

        # Validate
        if not user_id or not general_area or not specific_location or not language_spoken:
            return jsonify({"success": False, "error": "Missing required fields"}), 400
        if general_area not in LEXI_AREAS:
            # Allow 'Other' to carry any string via specific_location; map to 'Other'
            general_area = 'Other'

        # Numeric required
        try:
            num_speakers = int(data.get('num_speakers'))
        except Exception:
            return jsonify({"success": False, "error": "num_speakers must be an integer"}), 400
        if num_speakers < 0:
            return jsonify({"success": False, "error": "num_speakers must be >= 0"}), 400

        # Checkbox required
        was_part = data.get('was_part_of_conversation')
        if not isinstance(was_part, bool):
            return jsonify({"success": False, "error": "was_part_of_conversation must be boolean"}), 400

        followup_details = data.get('followup_details')
        comfortable = data.get('comfortable_to_ask_more')
        go_up = data.get('go_up_to_speakers')
        if go_up not in (None, 'Yes', 'No', "I don't know"):
            return jsonify({"success": False, "error": "go_up_to_speakers must be Yes, No, or I don't know"}), 400

        # Determination methods required (array of strings within allowed + optional 'Other')
        methods = data.get('determination_methods') or []
        if not isinstance(methods, list) or not methods:
            return jsonify({"success": False, "error": "determination_methods must be a non-empty array"}), 400
        methods_clean = []
        for m in methods:
            if not isinstance(m, str):
                continue
            if m in LEXI_DETERMINATION_OPTIONS:
                methods_clean.append(m)
            elif m.lower().startswith('other'):
                methods_clean.append('Other')
        if not methods_clean:
            return jsonify({"success": False, "error": "determination_methods contain no valid values"}), 400
        determination_other_text = data.get('determination_other_text')

        # Coordinates optional
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        import json as _json
        q = (
            """
            INSERT INTO lexi (
                user_id, general_area, specific_location, language_spoken,
                num_speakers, was_part_of_conversation, followup_details,
                comfortable_to_ask_more, go_up_to_speakers, determination_methods, determination_other_text,
                latitude, longitude,
                speaker_said_audio_url, speaker_origin, speaker_cultural_background,
                speaker_dialect, speaker_context, speaker_proficiency,
                speaker_gender_identity, speaker_gender_other_text,
                speaker_academic_level, additional_comments, outstanding_questions
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """
        )
        params = [
            user_id,
            general_area,
            specific_location,
            language_spoken,
            num_speakers,
            1 if was_part else 0,
            followup_details,
            comfortable,
            go_up,
            _json.dumps(methods_clean),
            determination_other_text,
            latitude,
            longitude,
            data.get('speaker_said_audio_url'),
            data.get('speaker_origin'),
            data.get('speaker_cultural_background'),
            data.get('speaker_dialect'),
            data.get('speaker_context'),
            data.get('speaker_proficiency'),
            data.get('speaker_gender_identity'),
            data.get('speaker_gender_other_text'),
            data.get('speaker_academic_level'),
            data.get('additional_comments'),
            data.get('outstanding_questions'),
        ]
        ok = db_operation(q, params)
        return jsonify({"success": bool(ok)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/lexi/responses', methods=['GET'])
def list_lexi_responses():
    try:
        q = "SELECT * FROM lexi ORDER BY created_at DESC"
        rows = db_operation(q, fetch_all=True) or []
        # Normalize types
        for r in rows:
            r['was_part_of_conversation'] = bool(r.get('was_part_of_conversation'))
            try:
                if isinstance(r.get('determination_methods'), str):
                    import json as _json
                    r['determination_methods'] = _json.loads(r['determination_methods'])
            except Exception:
                r['determination_methods'] = []
        return jsonify({"responses": rows})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/lexi/users', methods=['POST'])
def upsert_lexi_user():
    try:
        create_lexi_tables()
        data = request.json or {}
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        if not name or not email:
            return jsonify({"success": False, "error": "Missing name or email"}), 400
        import json as _json
        import uuid
        user = db_operation('SELECT * FROM users_lexi WHERE email = %s', [email], fetch_one=True)
        user_id = user['user_id'] if user else str(uuid.uuid4())
        anchor_answer = data.get('anchor_answer')
        if anchor_answer is None:
            anchor_answer_json = _json.dumps([])
        else:
            if not isinstance(anchor_answer, list):
                return jsonify({"success": False, "error": "anchor_answer must be array of strings"}), 400
            anchor_answer_json = _json.dumps(anchor_answer)
        q = (
            '''
            INSERT INTO users_lexi (user_id, name, email, anchor_answer)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                anchor_answer = VALUES(anchor_answer)
            '''
        )
        ok = db_operation(q, [user_id, name, email, anchor_answer_json])
        if ok:
            return jsonify({"success": True, "user": {"user_id": user_id, "name": name, "email": email, "anchor_answer": anchor_answer or []}})
        return jsonify({"success": False})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/lexi/users/<email>', methods=['GET'])
def get_lexi_user(email):
    try:
        user = db_operation('SELECT * FROM users_lexi WHERE email = %s', [email], fetch_one=True)
        if not user:
            return jsonify({}), 404
        try:
            import json as _json
            if isinstance(user.get('anchor_answer'), str):
                user['anchor_answer'] = _json.loads(user['anchor_answer'])
        except Exception:
            user['anchor_answer'] = []
        return jsonify(user)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/lexi/users/<email>/consent', methods=['POST'])
def update_consent(email):
    try:
        data = request.json or {}
        consent = 1 if bool(data.get('consent')) else 0
        ok = db_operation('UPDATE users_lexi SET consent_given = %s WHERE email = %s', [consent, email])
        return jsonify({"success": bool(ok)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# All task endpoints disabled in simplified mode

# Workspace join/anchor endpoints disabled in simplified mode

# Anchor question endpoint disabled in simplified mode

# Anchor answers endpoint disabled in simplified mode

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
