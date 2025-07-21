# VS Code Configuration for UTXO Blockchain Indexer

This directory contains VS Code configuration files optimized for developing the UTXO blockchain indexer.

## 📁 Configuration Files

### `launch.json` - Debug Configurations
Multiple launch configurations for different scenarios:

- **🚀 Launch UTXO Indexer** - Run the application normally
- **🐛 Debug UTXO Indexer** - Debug with breakpoints
- **🧪 Run Tests** - Execute the test suite
- **🔍 Debug Tests** - Debug tests with breakpoints
- **🐳 Debug with Docker DB** - Debug with automatic Docker database setup

### `tasks.json` - Build and Development Tasks
Pre-configured tasks for common development operations:

- **docker-compose-up** - Start PostgreSQL database
- **docker-compose-down** - Stop database services
- **install-dependencies** - Install Bun dependencies
- **run-tests** - Execute test suite
- **run-tests-watch** - Run tests in watch mode
- **build-app** - Build the application

### `settings.json` - Workspace Settings
Optimized settings for TypeScript development with:

- Auto-formatting on save
- Import organization
- TypeScript preferences
- File associations
- Terminal environment variables
- Testing configuration

### `extensions.json` - Recommended Extensions
Curated list of useful extensions for:

- TypeScript/JavaScript development
- Database management
- API testing
- Docker support
- Git integration
- Code quality

## 🚀 Quick Start

1. **Open the project in VS Code:**
   ```bash
   code .
   ```

2. **Install recommended extensions:**
   - VS Code will prompt to install recommended extensions
   - Or manually install from the Extensions panel

3. **Start debugging:**
   - Press `F5` or go to `Run and Debug` panel
   - Select "🚀 Launch UTXO Indexer"
   - The application will start with debugging enabled

## 🔧 Debug Configurations

### Standard Debugging
- **Launch UTXO Indexer**: Normal execution with debugging
- **Debug UTXO Indexer**: Starts with breakpoint on first line

### Testing
- **Run Tests**: Execute all tests
- **Debug Tests**: Debug test execution with breakpoints

### Docker Integration
- **Debug with Docker DB**: Automatically starts Docker Compose before debugging

## 🎯 Environment Variables

The configurations include proper environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `TEST_DATABASE_URL`: Test database connection
- `NODE_ENV`: Environment setting (development/test)

## 📋 Tasks

Access tasks via:
- Command Palette (`Cmd+Shift+P`) → "Tasks: Run Task"
- Terminal menu → "Run Task"

### Available Tasks:
- Start/stop Docker services
- Install dependencies
- Run tests (normal/watch mode)
- Build application

## 🔌 Recommended Extensions

### Essential
- **TypeScript/JavaScript**: Enhanced language support
- **PostgreSQL Client**: Database management
- **REST Client**: API testing

### Productivity
- **Docker**: Container management
- **GitLens**: Enhanced Git integration
- **Todo Tree**: Task tracking

### Quality
- **Prettier**: Code formatting
- **ESLint**: Code linting

## 🧪 API Testing

Use the included `api-test.http` file with the REST Client extension:

1. Install "REST Client" extension
2. Open `api-test.http`
3. Start the application
4. Click "Send Request" above each HTTP request

## 🐛 Debugging Tips

### Setting Breakpoints
- Click in the gutter next to line numbers
- Use conditional breakpoints for complex scenarios
- Set breakpoints in tests for test debugging

### Environment Setup
1. Make sure Docker is running
2. Database should be accessible
3. Use "Debug with Docker DB" for automatic setup

### Common Issues
- **Port conflicts**: Change port in configuration if 3000 is busy
- **Database connection**: Verify PostgreSQL is running
- **Bun not found**: Ensure Bun is installed and in PATH

## 📊 Performance Profiling

The debug configurations include:
- Performance timing in debug console
- Memory usage monitoring
- Request/response logging

## 🔄 Live Reloading

For development with auto-reload:
1. Use the "Launch UTXO Indexer" configuration
2. Or run the "dev" task from terminal
3. Changes to TypeScript files will trigger restart

## 🎛️ Customization

### Modify Database URL
Update in `.vscode/settings.json`:
```json
"terminal.integrated.env.osx": {
  "DATABASE_URL": "your-database-url"
}
```

### Add Custom Tasks
Add to `.vscode/tasks.json`:
```json
{
  "label": "your-custom-task",
  "type": "shell",
  "command": "your-command"
}
```

### Additional Launch Configs
Add to `.vscode/launch.json`:
```json
{
  "name": "Your Config",
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/your-script.ts"
}
```

---

**Happy debugging! 🚀** 