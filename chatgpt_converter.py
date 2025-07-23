#!/usr/bin/env python3
"""
ChatGPT to Obsidian Converter

Converts ChatGPT conversation exports (conversations.json) into Obsidian-friendly
Markdown files, with intelligent duplicate detection and clean formatting.
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Global variable for tracking processed conversation IDs
processed_ids = set()


def slugify(text: str) -> str:
    """Convert text to a URL-safe slug suitable for filenames."""
    # Convert to lowercase and replace spaces/special chars with hyphens
    slug = re.sub(r'[^\w\s-]', '', text.lower())
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug.strip('-')


def format_timestamp(timestamp: float) -> str:
    """Convert UNIX timestamp to YYYY-MM-DD format."""
    return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d')


def extract_messages(mapping: Dict) -> List[Dict[str, str]]:
    """
    Extract and order messages from the ChatGPT mapping structure.
    
    The mapping is a nested structure where each message has an ID and references
    to parent/child messages. We need to traverse this to get the conversation flow.
    """
    messages = []
    
    # Find the root message (usually has no parent)
    root_id = None
    for msg_id, msg_data in mapping.items():
        if msg_data.get('parent') is None and msg_data.get('message'):
            root_id = msg_id
            break
    
    if not root_id:
        # Fallback: use first message with content
        for msg_id, msg_data in mapping.items():
            if msg_data.get('message') and msg_data['message'].get('content'):
                root_id = msg_id
                break
    
    if not root_id:
        return messages
    
    # Traverse the conversation tree starting from root
    current_id = root_id
    visited = set()
    
    while current_id and current_id not in visited:
        visited.add(current_id)
        msg_data = mapping.get(current_id, {})
        message = msg_data.get('message', {})
        
        if message and message.get('content'):
            author = message.get('author', {}).get('role', 'unknown')
            content = message.get('content', {})
            
            # Handle different content structures
            text_content = ''
            if isinstance(content, dict):
                parts = content.get('parts', [])
                if parts and isinstance(parts, list):
                    text_content = ''.join(str(part) for part in parts if part)
            elif isinstance(content, str):
                text_content = content
            
            if text_content.strip():
                messages.append({
                    'author': author,
                    'content': text_content.strip()
                })
        
        # Find the next message in the conversation
        children = msg_data.get('children', [])
        current_id = children[0] if children else None
    
    return messages


def escape_markdown(text: str) -> str:
    """Escape characters that could break Markdown formatting."""
    # Escape backslashes first to avoid double-escaping
    text = text.replace('\\', '\\\\')
    # Escape other problematic characters
    text = text.replace('*', '\\*')
    text = text.replace('_', '\\_')
    text = text.replace('`', '\\`')
    text = text.replace('[', '\\[')
    text = text.replace(']', '\\]')
    return text


def convert_conversation_to_markdown(conversation: Dict) -> str:
    """Convert a single conversation to Markdown format."""
    title = conversation.get('title', 'Untitled Conversation')
    create_time = conversation.get('create_time', 0)
    mapping = conversation.get('mapping', {})
    
    # Extract and format messages
    messages = extract_messages(mapping)
    
    # Build Markdown content
    content_lines = [
        f"# {title}",
        "",
        f"**Created:** {datetime.fromtimestamp(create_time).strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "---",
        ""
    ]
    
    for message in messages:
        author = message['author']
        text = message['content']
        
        # Format author name
        author_display = "**User:**" if author == "user" else "**Assistant:**"
        
        content_lines.append(author_display)
        content_lines.append("")
        content_lines.append(text)
        content_lines.append("")
    
    return '\n'.join(content_lines)


def get_existing_conversation_ids(output_dir: Path) -> set:
    """Get set of conversation IDs that have already been imported."""
    existing_ids = set()
    
    if not output_dir.exists():
        return existing_ids
    
    # Look for files matching the pattern and extract conversation IDs
    for file_path in output_dir.glob('*.md'):
        filename = file_path.stem
        # Extract ID from the end of filename (after last underscore)
        parts = filename.split('_')
        if len(parts) >= 3:  # date_title_id format
            conversation_id = parts[-1]
            existing_ids.add(conversation_id)
    
    return existing_ids


def generate_filename(conversation: Dict) -> str:
    """Generate filename in format: {date}_{slugified-title}_{conversation-id}.md"""
    conversation_id = conversation.get('id', 'unknown')
    title = conversation.get('title', 'untitled')
    create_time = conversation.get('create_time', 0)
    
    date_str = format_timestamp(create_time)
    title_slug = slugify(title)
    
    # Truncate title slug if too long to keep filename reasonable
    if len(title_slug) > 50:
        title_slug = title_slug[:50].rstrip('-')
    
    return f"{date_str}_{title_slug}_{conversation_id}.md"


def process_conversations(conversations):
    """
    Process conversations and convert to file data structures.
    Returns a dictionary with processing results for testing compatibility.
    """
    results = {
        'processed': 0,
        'skipped': 0,
        'errors': 0,
        'files': []
    }
    
    # Use global processed_ids for duplicate detection
    global processed_ids
    if 'processed_ids' not in globals():
        processed_ids = set()
    
    for conversation in conversations:
        # Handle None or non-dict conversations
        if not conversation or not isinstance(conversation, dict):
            print("⚠️  Warning: Invalid conversation data found, skipping")
            results['errors'] += 1
            continue
            
        conversation_id = conversation.get('id')
        
        if not conversation_id:
            print("⚠️  Warning: Conversation without ID found, skipping")
            results['errors'] += 1
            continue
        
        # Skip if already processed
        if conversation_id in processed_ids:
            print(f"⏭️  Skipping: {conversation.get('title', 'Untitled')} (already processed)")
            results['skipped'] += 1
            continue
        
        try:
            # Convert conversation to Markdown
            markdown_content = convert_conversation_to_markdown(conversation)
            
            # Generate filename
            filename = generate_filename(conversation)
            
            # Create file data structure
            file_data = {
                'filename': filename,
                'content': markdown_content,
                'title': conversation.get('title', 'Untitled'),
                'conversation_id': conversation_id
            }
            
            results['files'].append(file_data)
            processed_ids.add(conversation_id)
            results['processed'] += 1
            
        except Exception as e:
            print(f"❌ Error processing conversation '{conversation.get('title', 'Unknown')}': {e}")
            results['errors'] += 1
    
    return results


def main():
    """Main function to process ChatGPT conversations."""
    input_file = Path('conversations.json')
    output_dir = Path('ChatGPT')
    
    # Check if input file exists
    if not input_file.exists():
        print(f"❌ Error: {input_file} not found")
        print("Please ensure you have the conversations.json file from your ChatGPT export")
        return
    
    # Create output directory if it doesn't exist
    output_dir.mkdir(exist_ok=True)
    
    # Load conversations
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            conversations = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing JSON: {e}")
        return
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return
    
    # Get existing conversation IDs to avoid duplicates
    existing_ids = get_existing_conversation_ids(output_dir)
    
    # Initialize global processed_ids for this run
    global processed_ids
    processed_ids = existing_ids.copy()
    
    # Process conversations using the new function
    results = process_conversations(conversations)
    
    # Write files to disk
    for file_data in results['files']:
        output_path = output_dir / file_data['filename']
        
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(file_data['content'])
            
            print(f"✅ Converted: {file_data['title']} → {file_data['filename']}")
            
        except Exception as e:
            print(f"❌ Error writing file '{file_data['filename']}': {e}")
            results['errors'] += 1
            results['processed'] -= 1
    
    # Summary
    print("\n" + "="*50)
    print(f"📊 Summary:")
    print(f"   ✅ Processed: {results['processed']} conversations")
    print(f"   ⏭️  Skipped: {results['skipped']} conversations (already imported)")
    print(f"   ❌ Errors: {results['errors']} conversations") if results['errors'] > 0 else None
    print(f"   📁 Output directory: {output_dir.absolute()}")


if __name__ == "__main__":
    main() 