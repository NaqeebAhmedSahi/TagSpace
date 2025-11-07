#!/bin/bash

# Script to check PDF data in auth.db
# This script helps you inspect the SQLite database

# Find the database path (adjust based on your OS)
# Linux: ~/.config/tagspaces/auth.db
# macOS: ~/Library/Application Support/tagspaces/auth.db
# Windows: %APPDATA%/tagspaces/auth.db

# Try to find the database
DB_PATH=""

# Check common locations
if [ -f "$HOME/.config/tagspaces/auth.db" ]; then
  DB_PATH="$HOME/.config/tagspaces/auth.db"
elif [ -f "$HOME/Library/Application Support/tagspaces/auth.db" ]; then
  DB_PATH="$HOME/Library/Application Support/tagspaces/auth.db"
elif [ -f "$HOME/.tagspaces/auth.db" ]; then
  DB_PATH="$HOME/.tagspaces/auth.db"
else
  echo "Database not found in common locations."
  echo "Please provide the full path to auth.db:"
  read -r DB_PATH
fi

if [ ! -f "$DB_PATH" ]; then
  echo "Error: Database file not found at $DB_PATH"
  exit 1
fi

echo "Database location: $DB_PATH"
echo ""
echo "========================================="
echo "Checking tables in database..."
echo "========================================="
sqlite3 "$DB_PATH" ".tables"

echo ""
echo "========================================="
echo "PDF Parsed Data Table Structure:"
echo "========================================="
sqlite3 "$DB_PATH" ".schema pdf_parsed_data"

echo ""
echo "========================================="
echo "All PDF Parsed Data:"
echo "========================================="
sqlite3 "$DB_PATH" "SELECT id, file_name, file_path, 
       LENGTH(parsed_text) as text_length, 
       LENGTH(parsed_json) as json_length,
       created_at, updated_at 
       FROM pdf_parsed_data;"

echo ""
echo "========================================="
echo "Count of records:"
echo "========================================="
sqlite3 "$DB_PATH" "SELECT COUNT(*) as total_records FROM pdf_parsed_data;"

echo ""
echo "========================================="
echo "To view full JSON data for a specific file:"
echo "========================================="
echo "Run: sqlite3 \"$DB_PATH\" \"SELECT parsed_json FROM pdf_parsed_data WHERE file_path = 'YOUR_FILE_PATH';\""
echo ""
echo "To view full text data:"
echo "sqlite3 \"$DB_PATH\" \"SELECT parsed_text FROM pdf_parsed_data WHERE file_path = 'YOUR_FILE_PATH';\""

