import hashlib
import json
import os
import time
from typing import Dict, List, Optional, Tuple

try:
    import google.generativeai as genai
except ImportError:
    print("Warning: google.generativeai not installed. Typo checking will be disabled.")
    genai = None


class GeminiTypoChecker:
    """Modular Gemini API wrapper for typo checking with aggressive caching for free tier"""

    def __init__(self):
        self.cache: Dict[str, Dict] = {}
        self.cache_size_limit = 200  # Increased for free tier
        self.api_key = os.environ.get('GEMINI_API_KEY')
        self.model_name = 'gemini-2.0-flash-exp'
        self.daily_api_calls = 0
        self.last_reset_date = time.strftime('%Y-%m-%d')
        self.max_daily_calls = 50  # Conservative limit for free tier

        if self.api_key and genai:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel(self.model_name)
            self.enabled = True
        else:
            self.model = None
            self.enabled = False
            print("Warning: Gemini API key not configured or library not available")

    def _get_cache_key(self, text: str) -> str:
        """Generate cache key for text"""
        return hashlib.md5(text.encode()).hexdigest()

    def _manage_cache_size(self):
        """Remove oldest entries if cache is full"""
        if len(self.cache) >= self.cache_size_limit:
            # Remove multiple oldest entries to make room
            keys_to_remove = list(self.cache.keys())[:20]  # Remove 20 oldest
            for key in keys_to_remove:
                del self.cache[key]

    def _check_daily_limit(self) -> bool:
        """Check if we've hit the daily API call limit"""
        current_date = time.strftime('%Y-%m-%d')

        # Reset counter if it's a new day
        if current_date != self.last_reset_date:
            self.daily_api_calls = 0
            self.last_reset_date = current_date

        if self.daily_api_calls >= self.max_daily_calls:
            print(f"[GeminiTypo] Daily API limit reached ({self.max_daily_calls}). Using cached results only.")
            return False

        return True

    def _is_common_word(self, text: str) -> bool:
        """Check if text is a common word that likely doesn't need checking"""
        common_words = {
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
            'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
            'after', 'above', 'below', 'between', 'among', 'within', 'without',
            'against', 'toward', 'towards', 'upon', 'across', 'behind', 'beneath',
            'beside', 'beyond', 'inside', 'outside', 'under', 'over', 'around',
            'along', 'throughout', 'despite', 'except', 'including', 'like',
            'near', 'off', 'out', 'since', 'until', 'while', 'within'
        }

        # Check if it's a single common word
        words = text.strip().lower().split()
        if len(words) == 1 and words[0] in common_words:
            return True

        # Check if it's very short (likely not worth checking)
        if len(text.strip()) <= 2:
            return True

        return False

    def check_typo(self, text: str) -> Dict:
        """
        Check text for typos with aggressive caching for free tier

        Args:
            text: Text to check for typos

        Returns:
            Dict with 'suggestions' list and 'has_typos' boolean
        """
        if not text or len(text.strip()) < 3:
            return {'suggestions': [], 'has_typos': False}

        if not self.enabled:
            return {'suggestions': [], 'has_typos': False, 'error': 'Gemini API not available'}

        # Skip common words to save API calls
        if self._is_common_word(text):
            return {'suggestions': [], 'has_typos': False, 'skipped': 'common_word'}

        # Check cache first
        cache_key = self._get_cache_key(text)
        if cache_key in self.cache:
            print(f"[GeminiTypo] Cache hit for text: {text[:20]}...")
            return self.cache[cache_key]

        # Check daily API limit
        if not self._check_daily_limit():
            # Return a generic response when limit is reached
            return {
                'suggestions': [],
                'has_typos': False,
                'error': 'Daily API limit reached. Please try again tomorrow.',
                'limit_reached': True
            }

        try:
            # Create prompt for typo detection
            prompt = f"""
            Check the following text for typos and spelling errors.
            You must respond with ONLY valid JSON in this exact format:
            {{
                "suggestions": [
                    {{
                        "original": "misspelled_word",
                        "corrected": "corrected_word",
                        "confidence": 0.95
                    }}
                ],
                "has_typos": true
            }}

            If no typos are found, respond with:
            {{
                "suggestions": [],
                "has_typos": false
            }}

            Text to check: "{text}"

            IMPORTANT: Respond with ONLY the JSON, no other text.
            """

            # Increment API call counter
            self.daily_api_calls += 1
            print(f"[GeminiTypo] API call #{self.daily_api_calls}/{self.max_daily_calls} for text: {text[:20]}...")

            response = self.model.generate_content(prompt)

            # Parse the response as JSON
            response_text = response.text.strip()

            # Try to find JSON in the response
            if response_text.startswith('{') and response_text.endswith('}'):
                result = json.loads(response_text)
            else:
                # Try to extract JSON from the response
                start = response_text.find('{')
                end = response_text.rfind('}') + 1
                if start != -1 and end != 0:
                    json_text = response_text[start:end]
                    result = json.loads(json_text)
                else:
                    raise json.JSONDecodeError("No JSON found in response", response_text, 0)

            # Cache the result
            self._manage_cache_size()
            self.cache[cache_key] = result
            print(f"[GeminiTypo] Cached result for text: {text[:20]}...")

            return result

        except json.JSONDecodeError as e:
            print(f"[GeminiTypo] Failed to parse response: {response.text}")
            error_result = {
                'suggestions': [],
                'has_typos': False,
                'error': f'Failed to parse Gemini response: {str(e)}'
            }
            # Cache error results too to avoid repeated failures
            self._manage_cache_size()
            self.cache[cache_key] = error_result
            return error_result

        except Exception as e:
            print(f"[GeminiTypo] API error: {str(e)}")
            return {
                'suggestions': [],
                'has_typos': False,
                'error': str(e)
            }

    def format_answers(self, text: str, main_data_type: str = '') -> Dict:
        """
        Format user answers using Gemini AI to extract and format simple comma-separated lists

        Args:
            text: Text to format (e.g., "I speak English and Spanish and French")
            main_data_type: The main data type being collected (e.g., "languages", "food", "weather")

        Returns:
            Dict with 'formatted_text' string
        """
        if not text or len(text.strip()) < 5:
            return {'formatted_text': text}

        if not self.enabled:
            return {'formatted_text': text, 'error': 'Gemini API not available'}

        # Check cache first
        cache_key = self._get_cache_key(f"format_{text}_{main_data_type}")
        if cache_key in self.cache:
            print(f"[GeminiFormat] Cache hit for text: {text[:20]}...")
            return self.cache[cache_key]

        # Check daily API limit
        if not self._check_daily_limit():
            return {
                'formatted_text': text,
                'error': 'Daily API limit reached. Please try again tomorrow.',
                'limit_reached': True
            }

        try:
            # Create prompt for answer formatting with main data type context
            if main_data_type:
                prompt = f"""Extract and format only the {main_data_type} from this text as a simple comma-separated list.

Examples for {main_data_type}:
- "Vietnamese English I speak Japanese too" → "Vietnamese, English, Japanese"
- "I speak English and Spanish and French" → "English, Spanish, French"
- "I know Python, JavaScript, and React" → "Python, JavaScript, React"
- "My interests are photography, cooking, and reading" → "photography, cooking, reading"
- "I can speak English, I also know Spanish, And a bit of French" → "English, Spanish, French"
- "Vietnamese and English and also Japanese" → "Vietnamese, English, Japanese"
- "I speak Vietnamese, English, and some Japanese" → "Vietnamese, English, Japanese"

Text: "{text}"

Extract ONLY the {main_data_type} items from the text, ignoring filler words like "I speak", "and", "also", "too", etc. Format them as a clean comma-separated list. Return only the formatted list, nothing else."""
            else:
                prompt = f"""Extract and format the main items from this text as a simple comma-separated list.

Examples:
- "Vietnamese English I speak Japanese too" → "Vietnamese, English, Japanese"
- "I speak English and Spanish and French" → "English, Spanish, French"
- "I know Python, JavaScript, and React" → "Python, JavaScript, React"
- "My interests are photography, cooking, and reading" → "photography, cooking, reading"
- "I can speak English, I also know Spanish, And a bit of French" → "English, Spanish, French"

Text: "{text}"

Extract the main items from the text, ignoring filler words. Format them as a clean comma-separated list. Return only the formatted list, nothing else."""

            # Increment API call counter
            self.daily_api_calls += 1
            print(f"[GeminiFormat] API call #{self.daily_api_calls}/{self.max_daily_calls} for text: {text[:20]}...")

            response = self.model.generate_content(prompt)
            formatted_text = response.text.strip()

            # Clean up the response
            if formatted_text.startswith('"') and formatted_text.endswith('"'):
                formatted_text = formatted_text[1:-1]

            result = {'formatted_text': formatted_text}

            # Cache the result
            self._manage_cache_size()
            self.cache[cache_key] = result
            print(f"[GeminiFormat] Cached result for text: {text[:20]}...")

            return result

        except Exception as e:
            print(f"[GeminiFormat] API error: {str(e)}")
            return {
                'formatted_text': text,
                'error': str(e)
            }

    def get_cache_stats(self) -> Dict:
        """Get cache statistics"""
        return {
            'cache_size': len(self.cache),
            'cache_limit': self.cache_size_limit,
            'enabled': self.enabled,
            'model': self.model_name if self.enabled else None,
            'daily_api_calls': self.daily_api_calls,
            'max_daily_calls': self.max_daily_calls,
            'remaining_calls': max(0, self.max_daily_calls - self.daily_api_calls),
            'last_reset_date': self.last_reset_date
        }

    def clear_cache(self):
        """Clear the cache"""
        self.cache.clear()
        print("[GeminiTypo] Cache cleared")

    def reset_daily_counter(self):
        """Reset the daily API call counter"""
        self.daily_api_calls = 0
        self.last_reset_date = time.strftime('%Y-%m-%d')
        print("[GeminiTypo] Daily API counter reset")


# Global instance
typo_checker = GeminiTypoChecker()


def check_typo_api(text: str) -> Dict:
    """
    API function to check typo (for Flask route)

    Args:
        text: Text to check for typos

    Returns:
        Dict with typo suggestions
    """
    return typo_checker.check_typo(text)


def get_cache_stats() -> Dict:
    """Get cache statistics"""
    return typo_checker.get_cache_stats()


def clear_cache():
    """Clear the typo checker cache"""
    typo_checker.clear_cache()


def reset_daily_counter():
    """Reset the daily API call counter"""
    global typo_checker
    if typo_checker:
        typo_checker.daily_api_calls = 0
        typo_checker.last_reset_date = time.strftime('%Y-%m-%d')
        print("[Gemini] Daily counter reset")


def format_answers_api(text: str, main_data_type: str = '') -> Dict:
    """Format answers using Gemini AI - API wrapper function"""
    print(f"[DEBUG] Gemini format_answers_api called with text: '{text}', main_data_type: '{main_data_type}'")
    global typo_checker
    if not typo_checker:
        typo_checker = GeminiTypoChecker()
    result = typo_checker.format_answers(text, main_data_type)
    print(f"[DEBUG] Gemini format_answers_api result: {result}")
    return result
