import json
import os
import random
import threading
import time
import uuid
from datetime import datetime, timedelta

from database_utils import db_operation, sanitize_column_name
from task_config import (AREA_QUESTION_TEXT, ENABLE_DEBUG_LOGS,
                         MAX_AREAS_TO_CREATE_TASKS_FOR, TASK_CREATION_HOUR,
                         TASK_CREATION_MINUTE, TASKS_PER_AREA)


def tasks_already_created_today():
    """
    Check if tasks were already created today.
    Returns True if tasks were created today, False otherwise.
    """
    lock_file = "task_creation.lock"
    current_date = datetime.now().date()

    if os.path.exists(lock_file):
        try:
            with open(lock_file, 'r') as f:
                lock_date = f.read().strip()
                if lock_date == str(current_date):
                    return True
                elif lock_date != str(current_date):
                    # Clean up old lock file
                    print(f"[TaskCreation] Cleaning up old lock file from {lock_date}")
                    os.remove(lock_file)
        except:
            pass

    return False

def create_daily_task_pool():
    """
    Creates a daily pool of unassigned tasks for each workspace.
    This runs once per day.
    """
    # Use a lock file to prevent multiple instances
    lock_file = "task_creation.lock"
    current_date = datetime.now().date()

    # Check if lock file exists and is from today
    if os.path.exists(lock_file):
        try:
            with open(lock_file, 'r') as f:
                lock_date = f.read().strip()
                if lock_date == str(current_date):
                    print(f"[TaskCreation] Task creation already completed today ({current_date}), skipping...")
                    return
                elif lock_date != str(current_date):
                    # Clean up old lock file
                    print(f"[TaskCreation] Cleaning up old lock file from {lock_date}")
                    os.remove(lock_file)
        except:
            pass

    # Create lock file immediately to prevent race conditions
    try:
        with open(lock_file, 'w') as f:
            f.write(str(current_date))
    except:
        print("[TaskCreation] Warning: Could not create lock file")
        return  # Don't proceed if we can't create the lock

    print("[TaskCreation] Starting daily task creation...")

    # Check if tasks were already created today before proceeding
    workspaces = db_operation('SELECT * FROM workspaces', fetch_all=True) or []
    tasks_created_today = 0

    for ws in workspaces:
        ws_id = ws['id']
        table_name = f"workspace_{ws_id}_responses"
        today_tasks = db_operation(f'SELECT COUNT(*) as cnt FROM {table_name} WHERE DATE(time_task_created)=%s', [current_date], fetch_one=True)
        if today_tasks:
            tasks_created_today += today_tasks['cnt']

    if tasks_created_today > 0:
        print(f"[TaskCreation] Found {tasks_created_today} tasks already created today, skipping creation...")
        # Update lock file to reflect that tasks were already created
        try:
            with open(lock_file, 'w') as f:
                f.write(str(current_date))
        except:
            pass
        return

    print(f"[TaskCreation] Found {len(workspaces)} workspaces")

    total_tasks_created = 0

    for ws in workspaces:
        ws_id = ws['id']
        ws_name = ws.get('name', 'Unknown')
        print(f"[TaskCreation] Processing workspace: {ws_name} (ID: {ws_id})")
        questions = ws.get('questions')
        if isinstance(questions, str):
            try:
                questions = json.loads(questions)
            except Exception:
                questions = []
        table_name = f"workspace_{ws_id}_responses"

        # Find the area question and its column name
        area_question = next((q for q in (questions or []) if q.get('text') == AREA_QUESTION_TEXT), None)
        if not area_question:
            continue
        area_col = sanitize_column_name(area_question['text'])
        area_options = area_question.get('options', [])

        # Count visits for each area
        area_counts = []
        for area in area_options:
            visit_count = db_operation(f'SELECT COUNT(*) as cnt FROM {table_name} WHERE `{area_col}`=%s AND user_id IS NOT NULL', [area], fetch_one=True)
            count = visit_count['cnt'] if visit_count else 0
            area_counts.append((area, count))

        # Find the bottom areas with the least visits
        area_counts.sort(key=lambda x: x[1])
        print(f"[TaskCreation] Workspace {ws_id}: Found {len(area_counts)} areas")

        if len(area_counts) > 0:
            # Find the cutoff count for the Nth lowest
            if len(area_counts) > MAX_AREAS_TO_CREATE_TASKS_FOR:
                cutoff = area_counts[MAX_AREAS_TO_CREATE_TASKS_FOR - 1][1]
                bottom_areas = [a for a, c in area_counts if c <= cutoff]
                # If more than MAX_AREAS, randomly pick MAX_AREAS
                if len(bottom_areas) > MAX_AREAS_TO_CREATE_TASKS_FOR:
                    bottom_areas = random.sample(bottom_areas, MAX_AREAS_TO_CREATE_TASKS_FOR)
            else:
                bottom_areas = [a for a, c in area_counts]

            print(f"[TaskCreation] Workspace {ws_id}: Creating tasks for {len(bottom_areas)} areas: {bottom_areas}")

            for area in bottom_areas:
                # Create TASKS_PER_AREA unassigned tasks for each of the lowest areas
                unassigned = db_operation(f'SELECT COUNT(*) as cnt FROM {table_name} WHERE `{area_col}`=%s AND user_id IS NULL', [area], fetch_one=True)
                existing_count = unassigned['cnt'] if unassigned else 0
                print(f"[TaskCreation] Workspace {ws_id}, Area '{area}': {existing_count} existing unassigned tasks")

                # Only create tasks if we have 0 unassigned tasks (matching the attached code)
                if existing_count == 0:
                    print(f"[TaskCreation] Creating {TASKS_PER_AREA} task(s) for area '{area}'")
                    for _ in range(TASKS_PER_AREA):
                        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        task_id = str(uuid.uuid4())
                        columns = [
                            'task_id',
                            'time_task_created',
                            'user_id',
                            'time_task_assigned',
                            'time_task_responded',
                            'time_completed',
                            f'`{area_col}`',
                            'latitude',
                            'longitude',
                            'task_status'
                        ]
                        values = [
                            task_id,
                            now,
                            None,  # user_id
                            None,  # time_task_assigned
                            None,  # time_task_responded
                            None,  # time_completed
                            area,
                            None,  # latitude
                            None,  # longitude
                            'created'
                        ]
                        for q in (questions or []):
                            if sanitize_column_name(q['text']) != area_col:
                                columns.append(f'`{sanitize_column_name(q["text"])}`')
                                values.append(None)
                        placeholders = ', '.join(['%s'] * len(values))
                        query = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
                        db_operation(query, values)
                        total_tasks_created += 1
                        if ENABLE_DEBUG_LOGS:
                            print(f"[TaskCreation] Created unassigned task for workspace {ws_id} at area '{area}'")

    print(f"[TaskCreation] Daily task creation complete at {datetime.now().strftime('%H:%M')}. Total tasks created: {total_tasks_created}")

def run_scheduled_task_creation():
    """
    Background thread that runs task creation once per day at 6:15 PM.
    If task creation is already completed today, schedule for tomorrow.
    """
    print("[TaskCreation] Background scheduled task creation thread started.")
    print(f"[TaskCreation] Task creation: Daily at {TASK_CREATION_HOUR}:{TASK_CREATION_MINUTE:02d}")

    while True:
        try:
            now = datetime.now()
            current_hour = now.hour
            current_minute = now.minute
            current_date = now.date()

            # Check if tasks were already created today
            lock_file = "task_creation.lock"
            tasks_already_created_today = False

            if os.path.exists(lock_file):
                try:
                    with open(lock_file, 'r') as f:
                        lock_date = f.read().strip()
                        if lock_date == str(current_date):
                            tasks_already_created_today = True
                            print(f"[TaskCreation] Tasks already created today ({current_date}), scheduling for tomorrow...")
                except:
                    pass

            # Check if it's time to create tasks
            should_create_tasks = False

            if (current_hour == TASK_CREATION_HOUR and current_minute == TASK_CREATION_MINUTE):
                # Normal scheduled run at 6:15 PM
                if not tasks_already_created_today:
                    should_create_tasks = True
                    print(f"[TaskCreation] Scheduled run - creating daily task pool at {now.strftime('%H:%M')}...")
                else:
                    print(f"[TaskCreation] Tasks already created today, skipping scheduled run...")

            if should_create_tasks:
                create_daily_task_pool()

            # Calculate sleep time until next scheduled run
            now = datetime.now()
            next_run = now.replace(hour=TASK_CREATION_HOUR, minute=TASK_CREATION_MINUTE, second=0, microsecond=0)

            # If we've already passed today's scheduled time, schedule for tomorrow
            if now >= next_run:
                next_run = next_run + timedelta(days=1)

            sleep_seconds = (next_run - now).total_seconds()
            print(f"[TaskCreation] Next run scheduled for {next_run.strftime('%Y-%m-%d %H:%M')} (in {sleep_seconds/3600:.1f} hours)")
            time.sleep(sleep_seconds)

        except Exception as e:
            print("[TaskCreation] Error in scheduled task creation:", e)
            import traceback
            traceback.print_exc()
            time.sleep(60 * 60)  # Sleep for 1 hour on error

# Start background thread when imported (only once)
_task_creation_thread_started = False
_task_creation_thread = None

def start_task_creation_thread():
    global _task_creation_thread_started, _task_creation_thread

    # Check if thread is already running
    if _task_creation_thread and _task_creation_thread.is_alive():
        print("[TaskCreation] Background task creation thread already running, skipping...")
        return

    if not _task_creation_thread_started:
        print("[TaskCreation] Starting background task creation thread...")
        _task_creation_thread = threading.Thread(target=run_scheduled_task_creation, daemon=True)
        _task_creation_thread.start()
        _task_creation_thread_started = True
        print("[TaskCreation] Background task creation thread started successfully")
    else:
        print("[TaskCreation] Background task creation thread already started, skipping...")

# Don't auto-start - let the server control this
# start_task_creation_thread()
