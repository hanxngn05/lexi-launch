import json
import re
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from transformers import pipeline


class MLanguageAnalyzer:
    def __init__(self, data_type: str = "languages"):
        """Initialize ML-based entity analyzer for any data type"""
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.data_type = data_type.lower()
        print(f"Using device: {self.device}")
        print(f"Initialized for data type: {self.data_type}")

        # Load NER pipeline for entity detection (research-optimized)
        self.ner_pipeline = pipeline(
            "ner",
            model="dslim/bert-base-NER",  # Keep this as it's still optimal for NER
            device=0 if torch.cuda.is_available() else -1
        )

        # Load zero-shot classification for entity validation and confidence (research-optimized)
        self.zero_shot_pipeline = pipeline(
            "zero-shot-classification",
            model="facebook/bart-large-mnli",  # Optimal for zero-shot tasks
            device=0 if torch.cuda.is_available() else -1
        )

        # Sentence transformer for semantic similarity (research-optimized)
        self.sentence_transformer = SentenceTransformer('all-mpnet-base-v2')  # Better than all-MiniLM-L6-v2

        # Load entity lists based on data type
        self.entity_list = self._load_entity_list()

        print(f"ML Entity Analyzer initialized successfully for {self.data_type}")

    def _load_entity_list(self) -> set:
        """Load entity list based on data type - now returns empty set for pure ML approach"""
        # Return empty set to rely entirely on ML models
        # The system will use NER + zero-shot classification for all entity detection
        return set()

    def extract_entities_ml(self, text: str) -> List[Dict[str, any]]:
        """Extract entities using simple ML approach"""
        if not text:
            return []

        try:
            entities = []

            # Step 1: Use NER to detect entities
            ner_results = self.ner_pipeline(text)
            print(f"NER detected {len(ner_results)} entities")

            # Step 2: Filter and accept only language entities
            for entity in ner_results:
                if entity['score'] > 0.5:  # Only high-confidence entities
                    potential_entity = entity['word'].strip()

                    # Filter for languages only - check if it's actually a language
                    if self._is_language_entity(potential_entity):
                        print(f"Accepting language entity: '{potential_entity}' (score: {entity['score']:.3f})")

                        # Calculate confidence score
                        entity_score = self._calculate_entity_score_ml(potential_entity, text)

                        entities.append({
                            'entity': potential_entity,
                            'type': self.data_type.upper(),
                            'confidence': entity_score['confidence'],
                            'start': entity['start'],
                            'end': entity['end']
                        })
                    else:
                        print(f"Filtering out non-language entity: '{potential_entity}' (score: {entity['score']:.3f})")

            # Step 3: Simple language detection if no entities found
            if self.data_type == "languages" and len(entities) == 0:
                print("No NER entities, checking for common languages...")
                common_languages = ["English", "Arabic", "Spanish", "French", "German", "Italian", "Portuguese",
                                  "Russian", "Chinese", "Japanese", "Korean", "Hindi", "Urdu", "Turkish"]

                for language in common_languages:
                    if language.lower() in text.lower():
                        print(f"Found language: {language}")
                        entity_score = self._calculate_entity_score_ml(language, text)
                        entities.append({
                            'entity': language,
                            'type': 'LANGUAGES',
                            'confidence': entity_score['confidence'],
                            'start': text.lower().find(language.lower()),
                            'end': text.lower().find(language.lower()) + len(language)
                        })

            return sorted(entities, key=lambda x: x['confidence'], reverse=True)

        except Exception as e:
            print(f"Error in entity extraction: {e}")
            return []

        # Removed complex validation - now we just accept NER entities directly

        # Removed complex zero-shot detection methods - now we just use NER + simple fallback

    def _is_language_entity(self, entity_name: str) -> bool:
        """Check if an entity is actually a language (not a country, person, etc.)"""
        if not entity_name:
            return False

        # Common languages that should be accepted
        common_languages = {
            "english", "arabic", "spanish", "french", "german", "italian", "portuguese",
            "russian", "chinese", "japanese", "korean", "hindi", "urdu", "turkish",
            "dutch", "swedish", "norwegian", "danish", "finnish", "polish", "czech",
            "hungarian", "romanian", "bulgarian", "serbian", "croatian", "slovenian",
            "slovak", "lithuanian", "latvian", "estonian", "greek", "hebrew", "persian",
            "thai", "vietnamese", "indonesian", "malay", "filipino", "tagalog", "swahili",
            "yoruba", "igbo", "hausa", "amharic", "somali", "zulu", "xhosa", "afrikaans",
            "bengali", "punjabi", "gujarati", "marathi", "tamil", "telugu", "kannada",
            "malayalam", "sinhala", "nepali", "burmese", "lao", "khmer", "mongolian",
            "kazakh", "uzbek", "kyrgyz", "tajik", "turkmen", "azerbaijani", "georgian",
            "armenian", "ukrainian", "belarusian", "moldovan", "albanian", "macedonian",
            "bosnian", "montenegrin", "icelandic", "faroese", "greenlandic", "sami",
            "basque", "catalan", "galician", "occitan", "breton", "cornish", "welsh",
            "irish", "scottish", "manx", "frisian", "luxembourgish", "romansh", "ladin",
            "friulian", "sardinian", "corsican", "sicilian", "venetian", "lombard",
            "piedmontese", "ligurian", "emilian", "romagnol", "tuscan", "neapolitan",
            "calabrese", "abruzzese", "molisan", "pugliese", "lucano", "campano",
            "laziale", "marchigiano", "umbro", "toscano", "sardo", "siciliano"
        }

        # Common non-language entities that should be filtered out
        non_languages = {
            "egypt", "usa", "united states", "america", "canada", "mexico", "brazil",
            "argentina", "chile", "peru", "colombia", "venezuela", "ecuador", "bolivia",
            "paraguay", "uruguay", "guyana", "suriname", "french guiana", "falkland islands",
            "uk", "united kingdom", "england", "scotland", "wales", "northern ireland",
            "ireland", "france", "germany", "italy", "spain", "portugal", "netherlands",
            "belgium", "switzerland", "austria", "luxembourg", "liechtenstein", "monaco",
            "andorra", "san marino", "vatican", "malta", "cyprus", "greece", "albania",
            "macedonia", "bulgaria", "romania", "serbia", "croatia", "slovenia", "slovakia",
            "czech republic", "poland", "hungary", "ukraine", "belarus", "moldova",
            "lithuania", "latvia", "estonia", "finland", "sweden", "norway", "denmark",
            "iceland", "faroe islands", "greenland", "russia", "kazakhstan", "uzbekistan",
            "kyrgyzstan", "tajikistan", "turkmenistan", "azerbaijan", "georgia", "armenia",
            "turkey", "syria", "lebanon", "jordan", "iraq", "iran", "kuwait", "saudi arabia",
            "yemen", "oman", "uae", "qatar", "bahrain", "israel", "palestine", "morocco",
            "algeria", "tunisia", "libya", "sudan", "south sudan", "ethiopia", "eritrea",
            "djibouti", "somalia", "kenya", "uganda", "tanzania", "rwanda", "burundi",
            "congo", "dr congo", "central african republic", "chad", "cameroon", "nigeria",
            "niger", "mali", "burkina faso", "senegal", "gambia", "guinea-bissau",
            "guinea", "sierra leone", "liberia", "ivory coast", "ghana", "togo", "benin",
            "equatorial guinea", "gabon", "sao tome and principe", "angola", "zambia",
            "zimbabwe", "botswana", "namibia", "south africa", "lesotho", "eswatini",
            "mozambique", "madagascar", "mauritius", "seychelles", "comoros", "mayotte",
            "reunion", "china", "japan", "south korea", "north korea", "mongolia",
            "taiwan", "hong kong", "macau", "vietnam", "laos", "cambodia", "thailand",
            "myanmar", "bangladesh", "india", "pakistan", "afghanistan", "nepal", "bhutan",
            "sri lanka", "maldives", "philippines", "indonesia", "malaysia", "singapore",
            "brunei", "east timor", "papua new guinea", "fiji", "vanuatu", "new caledonia",
            "solomon islands", "tuvalu", "kiribati", "marshall islands", "micronesia",
            "palau", "nauru", "australia", "new zealand", "cook islands", "niue",
            "tokelau", "samoa", "tonga", "french polynesia", "pitcairn islands"
        }

        entity_lower = entity_name.lower().strip()

        # Check if it's in the non-languages list
        if entity_lower in non_languages:
            return False

        # Check if it's in the languages list
        if entity_lower in common_languages:
            return True

        # For entities not in either list, use zero-shot to determine if it's a language
        try:
            language_categories = [
                "is a language name",
                "is a country name",
                "is a person name",
                "is an organization name",
                "is a place name"
            ]

            result = self.zero_shot_pipeline(
                entity_name,
                language_categories,
                hypothesis_template="This entity {{}}"
            )

            # If it's classified as a language name, accept it
            return result['labels'][0] == "is a language name" and result['scores'][0] > 0.6

        except Exception as e:
            print(f"Error in language classification for '{entity_name}': {e}")
            # If classification fails, be conservative and reject
            return False

    def _calculate_entity_score_ml(self, entity_name: str, text: str) -> Dict[str, any]:
        """Calculate confidence score using pure ML approach - how much they like/value this entity"""
        try:
            # Use zero-shot to determine how much they like/value this entity
            confidence_levels = [
                f"loves and is very proficient with {self.data_type}",
                f"likes and is good with {self.data_type}",
                f"is okay with and has basic knowledge of {self.data_type}",
                f"is learning and interested in {self.data_type}",
                f"doesn't really like or use {self.data_type}",
                f"has no interest in {self.data_type}"
            ]

            confidence_result = self.zero_shot_pipeline(
                f"Regarding {entity_name} {self.data_type} in: {text}",
                confidence_levels,
                hypothesis_template="This person {{}}"
            )

            # Map confidence levels to scores (0.0 to 1.0)
            confidence_mapping = {
                f"loves and is very proficient with {self.data_type}": 0.95,
                f"likes and is good with {self.data_type}": 0.8,
                f"is okay with and has basic knowledge of {self.data_type}": 0.6,
                f"is learning and interested in {self.data_type}": 0.7,
                f"doesn't really like or use {self.data_type}": 0.3,
                f"has no interest in {self.data_type}": 0.1
            }

            top_level = confidence_result['labels'][0]
            confidence_score = confidence_mapping.get(top_level, 0.5)

            # Use sentence transformers to refine the confidence score
            # Create templates for different confidence levels
            confidence_templates = [
                f"I love {entity_name} and use it every day",
                f"I like {entity_name} and am good at it",
                f"I know some {entity_name}",
                f"I am learning {entity_name}",
                f"I don't really use {entity_name}",
                f"I have no interest in {entity_name}"
            ]

            # Calculate similarity with templates
            text_embedding = self.sentence_transformer.encode([text])
            template_embeddings = self.sentence_transformer.encode(confidence_templates)

            similarities = cosine_similarity(text_embedding, template_embeddings)[0]
            max_similarity = np.max(similarities)

            # Adjust confidence based on similarity
            similarity_boost = max_similarity * 0.2
            final_confidence = min(confidence_score + similarity_boost, 1.0)
            final_confidence = max(final_confidence, 0.1)  # Minimum confidence

            return {
                'confidence': final_confidence,
                'ml_details': {
                    'confidence_level': top_level,
                    'confidence_confidence': confidence_result['scores'][0],
                    'similarity_score': max_similarity
                }
            }

        except Exception as e:
            print(f"Error in ML confidence scoring: {e}")
            return {
                'confidence': 0.5,
                'ml_details': {
                    'confidence_level': 'unknown',
                    'confidence_confidence': 0.0,
                    'similarity_score': 0.0
                }
            }

    def calculate_comprehensive_score(self, text: str) -> Dict[str, float]:
        """Calculate comprehensive ML-based confidence score"""
        if not text:
            return {
                'overall_score': 0.0,
                'confidence': 0.0,
                'entity_count': 0
            }

        try:
            # Extract entities using ML
            entities = self.extract_entities_ml(text)

            # Calculate average confidence
            avg_confidence = sum(entity['confidence'] for entity in entities) / max(len(entities), 1)

            # Overall score is just the average confidence
            overall_score = avg_confidence

            return {
                'overall_score': overall_score,
                'confidence': avg_confidence,
                'entity_count': len(entities),
                'entities': entities
            }

        except Exception as e:
            print(f"Error in comprehensive scoring: {e}")
            return {
                'overall_score': 0.0,
                'confidence': 0.0,
                'entity_count': 0,
                'entities': []
            }

    def rank_users_for_task_ml(self,
                              user_anchor_answers: Dict[str, str],
                              area_main_answers: List[str],
                              area_name: str = "") -> List[Tuple[str, float, Dict]]:
        """Rank users for task using pure ML approach"""
        try:
            ranked_users = []

            for user_id, answer in user_anchor_answers.items():
                # Analyze user's entity profile using ML
                user_analysis = self.calculate_comprehensive_score(answer)

                # Calculate similarity with area answers using sentence transformers
                user_embedding = self.sentence_transformer.encode([answer])
                area_embeddings = self.sentence_transformer.encode(area_main_answers)

                similarities = cosine_similarity(user_embedding, area_embeddings)[0]
                max_similarity = np.max(similarities)

                # Calculate ranking score
                base_score = user_analysis['overall_score']
                similarity_penalty = (1 - max_similarity) * 0.5
                final_score = base_score - similarity_penalty

                ranked_users.append((
                    user_id,
                    final_score,
                    {
                        'base_score': base_score,
                        'similarity_penalty': similarity_penalty,
                        'ml_analysis': user_analysis
                    }
                ))

            # Sort by score (highest first)
            ranked_users.sort(key=lambda x: x[1], reverse=True)

            return ranked_users

        except Exception as e:
            print(f"Error in ML user ranking: {e}")
            return []


# Create a factory function to get the appropriate analyzer
def get_entity_analyzer(data_type: str = "languages"):
    """Factory function to create an analyzer for the specified data type"""
    return MLanguageAnalyzer(data_type)


# Backward compatibility - keep the old name for existing code
sentiment_analyzer = MLanguageAnalyzer("languages")
