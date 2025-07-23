# ChatGPT to Obsidian Converter

Convert your ChatGPT conversation exports into Obsidian-friendly Markdown files with intelligent duplicate detection and clean formatting. Available as both a Python command-line tool and a modern web interface.

## 🎯 Features

- **🌐 Web Interface**: Modern drag-and-drop frontend for easy file conversion
- **🐍 Python CLI**: Command-line tool for batch processing and automation
- **🧠 Smart Duplicate Detection**: Automatically skips conversations already imported based on conversation ID
- **✨ Clean Markdown Formatting**: Properly formats conversations with clear author attribution
- **📁 Obsidian-Friendly**: Generates files with metadata and structure optimized for Obsidian
- **🔒 Safe Filenames**: Automatically slugifies titles and handles special characters
- **⚡ Vercel Deployment**: Deploy your own instance to Vercel with one click
- **🛡️ Privacy-First**: All processing happens in your browser - no server uploads

## 🚀 Quick Start Options

### Option 1: Web Interface (Recommended)

1. **Use Online**: Visit the deployed version at [your-vercel-url]
2. **Or Run Locally**:
   ```bash
   # Clone the repository
   git clone [your-repo-url]
   cd chatgpt-cursor-import
   
   # Start local server
   python -m http.server 8000
   # Visit http://localhost:8000
   ```

3. **Upload and Convert**:
   - Export your ChatGPT conversations (Settings → Data Controls → Export Data)
   - Drag and drop `conversations.json` into the web interface
   - Download individual files or all as a bundle

### Option 2: Python CLI

## 📋 Requirements

- Python 3.6 or higher
- No external dependencies (uses only standard library)

## 🚀 Quick Start

1. **Export your ChatGPT conversations**:
   - Go to ChatGPT Settings → Data Controls → Export Data
   - Download and extract the zip file
   - Locate the `conversations.json` file

2. **Place the export file**:
   ```bash
   # Copy conversations.json to the same directory as the script
   cp /path/to/your/export/conversations.json .
   ```

3. **Run the converter**:
   ```bash
   python chatgpt_converter.py
   ```

4. **Find your converted files**:
   - Files will be created in the `ChatGPT/` directory
   - Filename format: `{date}_{slugified-title}_{conversation-id}.md`
   - Example: `2025-01-20_redis-caching-strategies_abc123xyz.md`

## 📁 Output Structure

```
ChatGPT/
├── 2024-12-15_python-best-practices_conv001.md
├── 2024-12-16_obsidian-workflow_conv002.md
└── 2024-12-17_machine-learning-intro_conv003.md
```

Each Markdown file contains:
- Conversation title as H1 header
- Creation timestamp
- Clean message formatting with **User:** and **Assistant:** prefixes
- Proper spacing and readability

## 📝 Example Output

```markdown
# Redis Caching Strategies

**Created:** 2024-12-15 14:30:22

---

**User:**

What are the best practices for implementing Redis caching in a web application?

**Assistant:**

Here are the key best practices for implementing Redis caching:

1. **Choose the right data structures**
   - Use strings for simple key-value pairs
   - Use hashes for objects with multiple fields
   - Use lists for ordered data

2. **Set appropriate TTL values**
   - Consider your data freshness requirements
   - Use different TTLs for different types of data

...
```

## ⚙️ How It Works

### Input Format
The script expects a `conversations.json` file with this structure:
```json
[
  {
    "id": "unique-conversation-id",
    "title": "Conversation Title",
    "create_time": 1703520622.123,
    "mapping": {
      "message-id-1": {
        "message": {
          "author": {"role": "user"},
          "content": {"parts": ["User message text"]}
        },
        "children": ["message-id-2"]
      },
      "message-id-2": {
        "message": {
          "author": {"role": "assistant"},
          "content": {"parts": ["Assistant response"]}
        },
        "parent": "message-id-1"
      }
    }
  }
]
```

### Processing Steps
1. **Parse JSON**: Load and validate the conversations.json file
2. **Check Duplicates**: Scan existing files to identify already-imported conversations
3. **Extract Messages**: Traverse the conversation mapping to reconstruct message flow
4. **Generate Markdown**: Convert messages to clean Markdown format
5. **Create Files**: Write files with standardized naming convention

### Duplicate Detection
The script identifies existing conversations by parsing filenames in the output directory and extracting conversation IDs. This means you can safely run the script multiple times without creating duplicates.

## 🔧 Configuration

The script can be easily modified to customize:

- **Output directory**: Change `output_dir = Path('ChatGPT')` in the `main()` function
- **Filename format**: Modify the `generate_filename()` function
- **Markdown formatting**: Adjust the `convert_conversation_to_markdown()` function
- **Title slug length**: Change the truncation limit in `generate_filename()`

## ⚠️ Troubleshooting

### Common Issues

**"conversations.json not found"**
- Ensure the file is in the same directory as the script
- Check the file is properly extracted from the ChatGPT export

**"Error parsing JSON"**
- Verify the conversations.json file isn't corrupted
- Ensure it contains valid JSON data

**Missing messages in output**
- The script handles various ChatGPT export formats, but complex message structures might need adjustment
- Check the console output for any processing warnings

### File Encoding Issues
If you encounter encoding problems, ensure your conversations.json file is in UTF-8 format.

## 🛠️ Development

### Code Structure
- `slugify()`: Converts titles to filename-safe slugs
- `extract_messages()`: Parses the complex ChatGPT mapping structure
- `convert_conversation_to_markdown()`: Handles Markdown formatting
- `get_existing_conversation_ids()`: Manages duplicate detection
- `main()`: Orchestrates the entire conversion process

### Testing
To test with a small sample:
1. Create a minimal conversations.json with one conversation
2. Run the script and verify output format
3. Run again to test duplicate detection

## 📄 License

This project is open source and available under the MIT License.

## 🚀 Deploying to Vercel

### One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/chatgpt-cursor-import)

### Manual Deployment

1. **Fork this repository** to your GitHub account

2. **Connect to Vercel**:
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy
   vercel --prod
   ```

3. **Configure Domain** (optional):
   - Go to your Vercel dashboard
   - Add a custom domain
   - Update DNS settings

### Environment Setup
No environment variables or build steps required! This is a static site that runs entirely in the browser.

## 🏗️ Architecture

### Frontend (Web Interface)
- **Technology**: Vanilla HTML, CSS, and JavaScript
- **Features**: Drag-and-drop upload, progress tracking, bulk downloads
- **Processing**: All conversion happens client-side for privacy
- **Deployment**: Static site compatible with Vercel, Netlify, GitHub Pages

### Backend (Python CLI)
- **Technology**: Pure Python with standard library
- **Features**: Batch processing, filesystem integration, duplicate detection
- **Usage**: Local development and automation scripts

### File Structure
```
chatgpt-cursor-import/
├── index.html              # Web interface
├── converter.js            # Frontend conversion logic  
├── chatgpt_converter.py    # Python CLI tool
├── example_conversations.json # Sample data for testing
├── vercel.json            # Vercel deployment config
├── package.json           # Project metadata
├── README.md              # This file
└── AGENTS.md              # AI agent guidelines
```

## 🤝 Contributing

Contributions are welcome! Please ensure:
- Follow the guidelines in `AGENTS.md`
- Code follows the style and patterns in the existing files
- Include appropriate error handling
- Test with various ChatGPT export formats
- Update documentation for any new features
- Test both Python CLI and web interface 