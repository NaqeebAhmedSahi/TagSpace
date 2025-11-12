# Database Inspection Commands

## Quick Commands to Check PDF Data in auth.db

### 1. Find the Database Location

The database is stored in the Electron app's userData directory. To find it:

**Linux:**
```bash
# Usually in:
~/.config/tagspaces/auth.db
# or
~/.config/[app-name]/auth.db
```

**macOS:**
```bash
~/Library/Application Support/tagspaces/auth.db
```

**Windows:**
```
%APPDATA%\tagspaces\auth.db
```

### 2. Check if SQLite3 is installed

```bash
sqlite3 --version
```

If not installed:
- **Ubuntu/Debian:** `sudo apt-get install sqlite3`
- **macOS:** `brew install sqlite3` (or it may already be installed)
- **Windows:** Download from https://www.sqlite.org/download.html

### 3. Quick Database Commands

Replace `[DB_PATH]` with your actual database path.

#### View all tables:
```bash
sqlite3 [DB_PATH] ".tables"
```

#### View PDF table structure:
```bash
sqlite3 [DB_PATH] ".schema pdf_parsed_data"
```

#### View all PDF records (summary):
```bash
sqlite3 [DB_PATH] "SELECT id, file_name, file_path, 
       LENGTH(parsed_text) as text_length, 
       LENGTH(parsed_json) as json_length,
       created_at, updated_at 
       FROM pdf_parsed_data;"
```

#### Count records:
```bash
sqlite3 [DB_PATH] "SELECT COUNT(*) FROM pdf_parsed_data;"
```

#### View JSON for a specific file:
```bash
sqlite3 [DB_PATH] "SELECT parsed_json FROM pdf_parsed_data WHERE file_path = '/path/to/your/file.pdf';"
```

#### View text for a specific file:
```bash
sqlite3 [DB_PATH] "SELECT parsed_text FROM pdf_parsed_data WHERE file_path = '/path/to/your/file.pdf';"
```

#### View all data for a specific file:
```bash
sqlite3 [DB_PATH] "SELECT * FROM pdf_parsed_data WHERE file_path = '/path/to/your/file.pdf';"
```

#### Pretty print JSON (if jq is installed):
```bash
sqlite3 [DB_PATH] "SELECT parsed_json FROM pdf_parsed_data WHERE file_path = '/path/to/your/file.pdf';" | jq .
```

### 4. Interactive SQLite Session

```bash
sqlite3 [DB_PATH]
```

Then you can run SQL commands:
```sql
.tables
.schema pdf_parsed_data
SELECT * FROM pdf_parsed_data;
.quit
```

### 5. Using the Provided Script

Run the check-db.sh script:
```bash
./check-db.sh
```

Or if you know the exact path:
```bash
DB_PATH="~/.config/tagspaces/auth.db" sqlite3 "$DB_PATH" "SELECT * FROM pdf_parsed_data;"
```

### 6. Example: Find Database Path from Electron App

If you want to find the exact path programmatically, you can add this to your code temporarily:
```javascript
console.log('DB Path:', app.getPath('userData') + '/auth.db');
```

### 7. Delete Test Data (if needed)

```bash
sqlite3 [DB_PATH] "DELETE FROM pdf_parsed_data WHERE file_path = '/path/to/file.pdf';"
```

### 8. View All Data in a Readable Format

```bash
sqlite3 -header -column [DB_PATH] "SELECT * FROM pdf_parsed_data;"
```

### 9. Export Data to CSV

```bash
sqlite3 -header -csv [DB_PATH] "SELECT * FROM pdf_parsed_data;" > pdf_data.csv
```



