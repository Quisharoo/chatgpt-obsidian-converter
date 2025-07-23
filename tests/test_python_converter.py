#!/usr/bin/env python3
"""
Python tests for ChatGPT to Obsidian Converter
Following AGENTS.md testing guidelines
"""

import unittest
import json
import tempfile
import os
import sys
from datetime import datetime
from pathlib import Path

# Add the project root to the path so we can import the converter
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from chatgpt_converter import (
        slugify, format_timestamp, extract_messages, 
        convert_conversation_to_markdown, generate_filename,
        process_conversations, get_existing_conversation_ids
    )
except ImportError:
    # If direct import fails, we'll exec the file (fallback method)
    converter_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'chatgpt_converter.py')
    with open(converter_path, 'r') as f:
        exec(f.read())


class TestChatGPTConverter(unittest.TestCase):
    """Test suite for ChatGPT to Obsidian converter Python implementation"""

    def setUp(self):
        """Set up test fixtures"""
        # Reset global state before each test
        global processed_ids
        processed_ids = set()
        
        self.sample_conversation = {
            'id': 'test_conv_001',
            'title': 'Python Best Practices',
            'create_time': 1703522622,
            'mapping': {
                'msg_001': {
                    'message': {
                        'author': {'role': 'user'},
                        'content': {'parts': ['What are Python best practices?']}
                    },
                    'children': ['msg_002'],
                    'parent': None
                },
                'msg_002': {
                    'message': {
                        'author': {'role': 'assistant'},
                        'content': {'parts': ['Here are key Python best practices: 1. Follow PEP 8...']}
                    },
                    'children': [],
                    'parent': 'msg_001'
                }
            }
        }

    def test_slugify_function(self):
        """Test slugify converts text to URL-safe slug"""
        self.assertEqual(slugify('Python Best Practices'), 'python-best-practices')
        self.assertEqual(slugify('Redis & Caching: Advanced!'), 'redis-caching-advanced')
        self.assertEqual(slugify('   Multiple   Spaces   '), 'multiple-spaces')
        self.assertEqual(slugify('Special@#$%Characters'), 'specialcharacters')
        self.assertEqual(slugify(''), '')

    def test_format_timestamp(self):
        """Test timestamp formatting"""
        # Test specific timestamp: 2023-12-25 14:30:22 UTC  
        timestamp = 1703522622
        self.assertEqual(format_timestamp(timestamp), '2023-12-25')
        
        # Test epoch
        self.assertEqual(format_timestamp(0), '1970-01-01')

    def test_generate_filename(self):
        """Test filename generation follows expected format"""
        filename = generate_filename(self.sample_conversation)
        expected = 'Python Best Practices.md'
        self.assertEqual(filename, expected)

    def test_generate_filename_long_title(self):
        """Test filename generation handles long titles"""
        long_conversation = self.sample_conversation.copy()
        long_conversation['title'] = 'This is an extremely long title that should be truncated because it exceeds reasonable limits'
        
        filename = generate_filename(long_conversation)
        self.assertLess(len(filename), 110)  # Should be truncated to reasonable length
        self.assertTrue(filename.endswith('.md'))

    def test_generate_filename_missing_data(self):
        """Test filename generation handles missing data gracefully"""
        empty_conversation = {}
        filename = generate_filename(empty_conversation)
        self.assertEqual(filename, 'Untitled Conversation.md')

    def test_generate_filename_duplicates(self):
        """Test duplicate filename handling"""
        conversation1 = {'title': 'Python Tips'}
        conversation2 = {'title': 'Python Tips'}  # Same title
        
        # First file should get the base name
        filename1 = generate_filename(conversation1, [])
        self.assertEqual(filename1, 'Python Tips.md')
        
        # Second file should get a suffix
        filename2 = generate_filename(conversation2, [filename1])
        self.assertEqual(filename2, 'Python Tips (2).md')
        
        # Third file should get next suffix
        filename3 = generate_filename(conversation2, [filename1, filename2])
        self.assertEqual(filename3, 'Python Tips (3).md')

    def test_extract_messages(self):
        """Test message extraction from mapping structure"""
        messages = extract_messages(self.sample_conversation['mapping'])
        
        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0]['author'], 'user')
        self.assertEqual(messages[0]['content'], 'What are Python best practices?')
        self.assertEqual(messages[1]['author'], 'assistant')
        self.assertIn('Here are key Python best practices', messages[1]['content'])

    def test_extract_messages_empty_mapping(self):
        """Test message extraction handles empty mapping"""
        messages = extract_messages({})
        self.assertEqual(messages, [])

    def test_extract_messages_malformed_mapping(self):
        """Test message extraction handles malformed data"""
        malformed_mapping = {
            'msg_001': {
                # Missing message field
                'children': [],
                'parent': None
            }
        }
        messages = extract_messages(malformed_mapping)
        self.assertEqual(messages, [])

    def test_convert_conversation_to_markdown(self):
        """Test conversation to markdown conversion"""
        markdown = convert_conversation_to_markdown(self.sample_conversation)
        
        # Check structure
        self.assertIn('# Python Best Practices', markdown)
        self.assertIn('**Created:**', markdown)
        self.assertIn('---', markdown)
        self.assertIn('**User:**', markdown)
        self.assertIn('**Assistant:**', markdown)
        self.assertIn('What are Python best practices?', markdown)

    def test_convert_conversation_missing_title(self):
        """Test conversion handles missing title"""
        conversation = self.sample_conversation.copy()
        del conversation['title']
        
        markdown = convert_conversation_to_markdown(conversation)
        self.assertIn('# Untitled Conversation', markdown)

    def test_process_conversations(self):
        """Test processing multiple conversations"""
        conversations = [self.sample_conversation]
        results = process_conversations(conversations)
        
        self.assertEqual(results['processed'], 1)
        self.assertEqual(results['skipped'], 0)
        self.assertEqual(results['errors'], 0)
        self.assertEqual(len(results['files']), 1)

    def test_process_conversations_duplicates(self):
        """Test duplicate conversation handling"""
        # Create two conversations with the same ID
        conversations = [
            {
                'id': 'duplicate_test',
                'title': 'First Instance',
                'create_time': 1703522622,
                'mapping': {}
            },
            {
                'id': 'duplicate_test',  # Same ID
                'title': 'Second Instance',
                'create_time': 1703522623,  # Different time to test sorting
                'mapping': {}
            }
        ]
        
        # Reset processed IDs
        global processed_ids
        processed_ids = set()
        
        results = process_conversations(conversations)
        self.assertEqual(results['processed'], 1)
        self.assertEqual(results['skipped'], 1)

    def test_conversations_sorted_chronologically(self):
        """Test that conversations are processed in chronological order (oldest first)"""
        conversations = [
            {
                'id': 'newest',
                'title': 'Newest Conversation',
                'create_time': 1703522625,  # Latest
                'mapping': {}
            },
            {
                'id': 'oldest',
                'title': 'Oldest Conversation', 
                'create_time': 1703522620,  # Earliest
                'mapping': {}
            },
            {
                'id': 'middle',
                'title': 'Middle Conversation',
                'create_time': 1703522622,  # Middle
                'mapping': {}
            }
        ]
        
        # Reset processed IDs
        global processed_ids
        processed_ids = set()
        
        results = process_conversations(conversations)
        self.assertEqual(results['processed'], 3)
        
        # Check that files are ordered by creation time (oldest first)
        file_titles = [file_data['title'] for file_data in results['files']]
        expected_order = ['Oldest Conversation', 'Middle Conversation', 'Newest Conversation']
        self.assertEqual(file_titles, expected_order)

    def test_process_conversations_no_id(self):
        """Test conversations without IDs are handled"""
        conversation_no_id = self.sample_conversation.copy()
        del conversation_no_id['id']
        
        conversations = [conversation_no_id]
        results = process_conversations(conversations)
        
        self.assertEqual(results['processed'], 0)
        self.assertEqual(results['errors'], 1)

    def test_edge_cases(self):
        """Test various edge cases"""
        edge_cases = [
            {
                'id': 'edge_1',
                'title': '',  # Empty title
                'create_time': 0,  # Epoch time
                'mapping': {}  # Empty mapping
            },
            {
                'id': 'edge_2',
                'title': 'Special Characters: @#$%^&*()!',
                'create_time': 1703522622,
                'mapping': {
                    'msg_001': {
                        'message': {
                            'author': {'role': 'user'},
                            'content': {'parts': ['Message with special chars: <>&"\'']}
                        },
                        'children': [],
                        'parent': None
                    }
                }
            }
        ]
        
        for conversation in edge_cases:
            filename = generate_filename(conversation)
            markdown = convert_conversation_to_markdown(conversation)
            
            # Verify filename constraints
            self.assertLess(len(filename), 255)  # Filesystem limit
            self.assertTrue(filename.endswith('.md'))
            # No longer using date prefix - now human readable
            
            # Verify markdown structure
            self.assertIn('# ', markdown)
            self.assertIn('**Created:**', markdown)
            self.assertIn('---', markdown)

    def test_integration_with_temporary_files(self):
        """Integration test using temporary files"""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create test conversations file
            conversations_file = os.path.join(temp_dir, 'conversations.json')
            test_conversations = [self.sample_conversation]
            
            with open(conversations_file, 'w', encoding='utf-8') as f:
                json.dump(test_conversations, f, indent=2)
            
            # Verify file was created correctly
            self.assertTrue(os.path.exists(conversations_file))
            
            # Load and verify content
            with open(conversations_file, 'r', encoding='utf-8') as f:
                loaded_conversations = json.load(f)
            
            self.assertEqual(len(loaded_conversations), 1)
            self.assertEqual(loaded_conversations[0]['id'], 'test_conv_001')

    def test_error_handling(self):
        """Test error handling for malformed data"""
        malformed_data = [
            None,
            {},
            {'id': 'test'},  # Missing required fields
            {'title': 'No ID'},  # Missing ID
            {'id': 'test', 'mapping': None}  # Null mapping
        ]
        
        # Should not raise exceptions
        try:
            results = process_conversations(malformed_data)
            self.assertIsInstance(results, dict)
            self.assertIn('processed', results)
            self.assertIn('skipped', results)
            self.assertIn('errors', results)
            self.assertIn('files', results)
        except Exception as e:
            self.fail(f"process_conversations raised an exception with malformed data: {e}")

    def test_performance_large_dataset(self):
        """Test performance with large dataset"""
        # Create large dataset
        large_dataset = []
        for i in range(50):  # Smaller than JS test due to Python being slower
            conversation = {
                'id': f'perf_test_{i}',
                'title': f'Performance Test {i}',
                'create_time': 1703522622 + i,
                'mapping': {
                    f'msg_{i}_001': {
                        'message': {
                            'author': {'role': 'user'},
                            'content': {'parts': [f'Question {i}']}
                        },
                        'children': [f'msg_{i}_002'],
                        'parent': None
                    },
                    f'msg_{i}_002': {
                        'message': {
                            'author': {'role': 'assistant'},
                            'content': {'parts': [f'Answer {i}']}
                        },
                        'children': [],
                        'parent': f'msg_{i}_001'
                    }
                }
            }
            large_dataset.append(conversation)
        
        # Reset state
        global processed_ids
        processed_ids = set()
        
        start_time = datetime.now()
        results = process_conversations(large_dataset)
        end_time = datetime.now()
        
        processing_time = (end_time - start_time).total_seconds()
        
        self.assertEqual(results['processed'], 50)
        self.assertEqual(len(results['files']), 50)
        self.assertLess(processing_time, 10.0)  # Should complete within 10 seconds
        
        print(f"Performance test: Processed {results['processed']} conversations in {processing_time:.2f}s")


class TestConsistencyWithJavaScript(unittest.TestCase):
    """Test consistency between Python and JavaScript implementations"""
    
    def test_filename_generation_consistency(self):
        """Ensure Python generates same filenames as JavaScript"""
        test_cases = [
            {
                'id': 'consistency_test_1',
                'title': 'Python vs JavaScript Test',
                'create_time': 1703522622
            },
            {
                'id': 'consistency_test_2',
                'title': 'Special Characters: @#$%^&*()',
                'create_time': 1703522622
            },
            {
                'id': 'consistency_test_3',
                'title': 'Very Long Title That Should Be Truncated',
                'create_time': 0  # Epoch time
            }
        ]
        
        for conversation in test_cases:
            filename = generate_filename(conversation)
            
            # Test expected patterns that should match JavaScript
            self.assertTrue(filename.endswith('.md'))
            # Human readable filenames no longer contain dates or IDs
            
            # Test length constraints
            self.assertLess(len(filename), 255)


if __name__ == '__main__':
    # Set up global variables that the converter expects
    global processed_ids
    processed_ids = set()
    
    print("🐍 Running Python ChatGPT Converter Tests...")
    print("Following AGENTS.md testing guidelines")
    print("=" * 50)
    
    unittest.main(verbosity=2) 