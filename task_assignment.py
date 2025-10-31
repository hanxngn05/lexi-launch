import json
import random
import threading
import time
from datetime import datetime, timedelta

from server.database_utils import db_operation, expire_old_tasks, sanitize_column_name
# from sentiment_analysis import get_entity_analyzer  # COMMENTED OUT - Using proximity only
from task_config import (AREA_QUESTION_TEXT, ASSIGNMENT_HOURS,
                         ENABLE_DEBUG_LOGS, MAX_TASKS_PER_DAY, PROXIMITY_BONUS,
                         TASKS_PER_PERSON_PER_ASSIGNMENT, USER_ROLE)


def has_unassigned_tasks():
    """
    Check if there are any unassigned tasks available.
    Returns True if there are unassigned tasks, False otherwise.
    """
    workspaces = db_operation('SELECT * FROM workspaces', fetch_all=True) or []
    total_unassigned = 0

    for ws in workspaces:
        ws_id = ws['id']
        table_name = f"workspace_{ws_id}_responses"
        unassigned = db_operation(f'SELECT COUNT(*) as cnt FROM {table_name} WHERE user_id IS NULL AND time_task_assigned IS NULL', fetch_one=True)
        if unassigned:
            total_unassigned += unassigned['cnt']
    return total_unassigned > 0


def has_eligible_users():
    """
    Check if there are any eligible users available.
    Returns True if there are eligible users, False otherwise.
    """
    query = '''
        SELECT COUNT(*) as cnt FROM users_updated
        WHERE role = %s AND status = 'active'
    '''
    result = db_operation(query, [USER_ROLE], fetch_one=True)
    return result and result['cnt'] > 0


def should_assign_tasks():
    """
    Check if task assignment should run.
    Returns True if conditions are met, False otherwise.
    """
    return has_unassigned_tasks() and has_eligible_users()


def assign_tasks_to_users():
    """
    Assigns unassigned tasks to eligible users.
    This runs multiple times per day at scheduled hours.
    """
    print("[TaskAssignment] Starting task assignment...")

    # 1. For each workspace
    workspaces = db_operation('SELECT * FROM workspaces', fetch_all=True) or []
    print(f"[TaskAssignment] Found {len(workspaces)} workspaces")

    total_tasks_assigned = 0

    for ws in workspaces:
        ws_id = ws['id']
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

        print(f"[TaskAssignment] Processing workspace {ws_id} using proximity-based assignment")

        if ENABLE_DEBUG_LOGS:
            print(f"[TaskAssignment] Workspace {ws_id}: Area column = '{area_col}'")

        # 2. Get unassigned tasks for this workspace
        unassigned_query = f'''
            SELECT * FROM {table_name}
            WHERE user_id IS NULL AND time_task_assigned IS NULL
            ORDER BY time_task_created ASC
        '''
        unassigned_tasks = db_operation(unassigned_query, fetch_all=True) or []

        if not unassigned_tasks:
            print(f"[TaskAssignment] No unassigned tasks for workspace {ws_id}")
            continue

        print(f"[TaskAssignment] Found {len(unassigned_tasks)} unassigned tasks for workspace {ws_id}")

        # 3. Get eligible users
        eligible_users_query = '''
            SELECT * FROM users_updated
            WHERE role = %s AND status = 'active'
            ORDER BY created_at ASC
        '''
        eligible_users = db_operation(eligible_users_query, [USER_ROLE], fetch_all=True) or []

        if not eligible_users:
            print(f"[TaskAssignment] No eligible users found")
            continue

        print(f"[TaskAssignment] Found {len(eligible_users)} eligible users")

        # 4. For each unassigned task, find the best user using proximity-based assignment
        for task in unassigned_tasks:
            task_id = task['task_id']
            task_area = task.get(area_col, '')

            if not task_area:
                print(f"[TaskAssignment] Task {task_id} missing area, skipping")
                continue

            # Simple proximity-based assignment:
            # For now, we'll use random assignment with a proximity bonus concept
            # TODO: Implement actual GPS-based proximity when user locations are available

            # Get users who haven't done too many tasks today
            user_scores = []
            for user in eligible_users:
                user_id = user['id']

                # Count how many tasks this user has been assigned today
                today = datetime.now().date()
                task_count_query = f'''
                    SELECT COUNT(*) as cnt FROM {table_name}
                    WHERE user_id = %s AND DATE(time_task_assigned) = %s
                '''
                task_count = db_operation(task_count_query, [user_id, today], fetch_one=True)
                tasks_today = task_count['cnt'] if task_count else 0

                # Skip users who have reached their daily limit
                if tasks_today >= MAX_TASKS_PER_DAY:
                    continue

                # Base score (random for now, can be replaced with actual proximity calculation)
                base_score = random.uniform(0.1, 1.0)

                # Add proximity bonus (placeholder - would use actual GPS distance)
                proximity_score = base_score + (PROXIMITY_BONUS * 0.1)  # Small bonus for now

                user_scores.append((user_id, proximity_score, tasks_today))

            if not user_scores:
                print(f"[TaskAssignment] No eligible users for task {task_id} (all users at daily limit)")
                continue

            # Sort by score (highest first)
            user_scores.sort(key=lambda x: x[1], reverse=True)
            best_user_id, best_score, tasks_today = user_scores[0]

            if ENABLE_DEBUG_LOGS:
                print(f"[TaskAssignment] Task {task_id} assigned to user {best_user_id} with proximity score {best_score:.3f} (tasks today: {tasks_today})")

            # Update the task assignment
            assignment_query = f'''
                UPDATE {table_name}
                SET user_id = %s, time_task_assigned = NOW(), task_status = 'assigned'
                WHERE task_id = %s
            '''
            update_result = db_operation(assignment_query, [best_user_id, task_id])

            if update_result:
                total_tasks_assigned += 1
                print(f"[TaskAssignment] Successfully assigned task {task_id} to user {best_user_id}")
            else:
                print(f"[TaskAssignment] Failed to assign task {task_id} to user {best_user_id}")

    print(f"[TaskAssignment] Task assignment completed. Total tasks assigned: {total_tasks_assigned}")
    return total_tasks_assigned


def _get_user_anchor_answer(user_id: str, workspace_id: str) -> str:
    """
    Get user's anchor answer (welcome question response) for a specific workspace.
    This is stored when the user joins the workspace.
    """
    try:
        # Get user's workspaces and anchor answers
        user_query = 'SELECT workspaces, anchor_answers FROM users_updated WHERE id = %s'
        user_result = db_operation(user_query, [user_id], fetch_one=True)

        if not user_result:
            return ""

        # Parse workspaces and anchor answers
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

        # Check if user has joined this workspace and has an anchor answer
        if workspace_id in workspaces and workspace_id in anchor_answers:
            return anchor_answers[workspace_id]

        return ""

    except Exception as e:
        print(f"[TaskAssignment] Error getting user anchor answer: {e}")
        return ""


def run_task_assignment_scheduler():
    """
    Run the task assignment scheduler.
    This function runs continuously and assigns tasks at scheduled hours.
    """
    print("[TaskAssignment] Starting task assignment scheduler...")

    while True:
        try:
            current_time = datetime.now()
            current_hour = current_time.hour

            # Check if it's time to assign tasks
            if current_hour in ASSIGNMENT_HOURS:
                print(f"[TaskAssignment] It's {current_hour}:00, checking for task assignment...")

                if should_assign_tasks():
                    print("[TaskAssignment] Conditions met, starting task assignment...")
                    assigned_count = assign_tasks_to_users()
                    print(f"[TaskAssignment] Task assignment completed. Assigned {assigned_count} tasks.")
                else:
                    print("[TaskAssignment] Conditions not met, skipping task assignment.")

                # Wait until next hour to avoid multiple assignments
                time.sleep(3600)  # Wait 1 hour
            else:
                # Wait 5 minutes before checking again
                time.sleep(300)

        except Exception as e:
            print(f"[TaskAssignment] Error in task assignment scheduler: {e}")
            time.sleep(300)  # Wait 5 minutes before retrying


if __name__ == "__main__":
    # Run the scheduler
    run_task_assignment_scheduler()
