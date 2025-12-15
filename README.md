# Reson Studio - Digital Audio Workstation (DAW)

Reson Studio is a modern, web-based Digital Audio Workstation built with React, Electron, and FastAPI. It provides a comprehensive environment for music production, audio editing, and project management.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Frontend Components](#frontend-components)
3. [Backend Services](#backend-services)
4. [Key Features](#key-features)
5. [Project Structure](#project-structure)
6. [Installation & Setup](#installation--setup)
7. [Usage Guide](#usage-guide)
8. [API Documentation](#api-documentation)

- **Backend**: FastAPI-based REST API for data management and AI services
- **Database**: SQLite for user and project data storage
- **AI Models**: Python-based machine learning models for audio processing

### Technology Stack
- **Frontend**: React 18, Electron, Lucide React icons, CSS3
- **Database**: SQLite
- **AI/ML**: Python, TensorFlow/PyTorch (for audio models)
- **Build Tools**: Webpack, Babel, Concurrently

## Frontend Components

### Core Components

**Location**: `frontend/src/App.js`
**Purpose**: Main application entry point that manages routing and global state.

- Manages application routing between Dashboard and Home pages
- Handles global application state
- Provides context for theme and user preferences

**State Management**:
const [currentPage, setCurrentPage] = useState('dashboard');
const [user, setUser] = useState(null);
const [theme, setTheme] = useState('dark');
```
#### 2. Dashboard.js
**Location**: `frontend/src/pages/Dashboard.js`
**Purpose**: Main DAW interface containing all audio production tools.

- Manages multiple views (arrange, projects, settings, home)
- Handles project creation and management
- Controls transport (play/pause) and BPM settings
- Manages panel resizing and layout

```javascript
const [playing, setPlaying] = useState(false);
const [selectedClip, setSelectedClip] = useState(null);
const [view, setView] = useState('arrange');
const [bpm, setBpm] = useState(120);
const [projects, setProjects] = useState([]);
const [currentProject, setCurrentProject] = useState(null);

**View System**:
- **Arrange View**: Main DAW interface with timeline, tracks, and mixer
- **Projects View**: Project browser and management

#### 3. Navbar.js
- File operations (New Project, Open, Save)
- View switching buttons (Arrange, Projects, Settings, Home)
- Search functionality
- User information display
- Window controls (minimize, maximize, close) for Electron

**Electron Integration**:
```javascript
const [isElectron, setIsElectron] = useState(false);
const [isMaximized, setIsMaximized] = useState(false);

// Window control functions
const minimize = () => window.electronAPI?.minimize();
const toggleMaximize = async () => {
  await window.electronAPI?.maximize();
  const res = await window.electronAPI?.isMaximized();
  setIsMaximized(res);
};
```

#### 4. NewProjectModal.js
**Location**: `frontend/src/components/NewProjectModal.js`
**Purpose**: Modal dialog for creating new audio projects.

**Key Features**:
- Form validation (project name required)
- Project settings (BPM, sample rate, bit depth)
- Modal state management (open/close)
- Integration with project creation workflow

**Form Fields**:
- Project Name (required)
- Description (optional)
- BPM (default: 120)
- Sample Rate (default: 44100)
- Bit Depth (default: 16)

#### 5. SessionBrowser.js
**Location**: `frontend/src/components/SessionBrowser.js`
**Purpose**: Displays list of projects and sessions.

**Key Features**:
- Displays user-created projects
- Shows default session templates
- Supports project selection
- Updates dynamically when new projects are created

**Props**:
```javascript
export default function SessionBrowser({ projects = [] }) {
  const defaultSessions = ['Untitled Project', 'My Beat', 'Vocal Edit', 'Soundscape'];
  const allProjects = [...projects, ...defaultSessions];
  // ...
}
```

#### 6. ProjectSidebar.js
**Location**: `frontend/src/components/ProjectSidebar.js`
**Purpose**: Wrapper component that passes project data to SessionBrowser.

**Key Features**:
- Acts as a bridge between Dashboard and SessionBrowser
- Manages project data flow
- Provides consistent interface for project display

#### 7. TransportBar.js
**Location**: `frontend/src/components/TransportBar.js`
**Purpose**: Audio transport controls and tempo settings.

**Key Features**:
- Play/pause/stop controls
- BPM display and adjustment
- Time position display
- Loop and record controls

#### 8. Timeline.js
**Location**: `frontend/src/components/Timeline.js`
**Purpose**: Time-based visualization of audio tracks.

**Key Features**:
- Horizontal timeline with time markers
- Zoom controls
- Grid snapping
- Time selection and navigation

#### 9. TrackList.js
**Location**: `frontend/src/components/TrackList.js`
**Purpose**: Vertical list of audio tracks in the arrange view.

**Key Features**:
- Track creation and management
- Track selection and editing
- Volume and pan controls per track
- Track reordering via drag-and-drop

#### 10. Mixer.js
**Location**: `frontend/src/components/Mixer.js`
**Purpose**: Channel strip controls for audio mixing.

**Key Features**:
- Volume faders for each track
- Pan controls
- Solo/mute buttons
- EQ controls (if implemented)
- Send/return controls

#### 11. Inspector.js
**Location**: `frontend/src/components/Inspector.js`
**Purpose**: Properties panel for selected audio clips and tracks.

**Key Features**:
- Clip properties (start time, duration, fade in/out)
- Audio processing parameters
- Effect settings
- Automation curves

#### 12. PluginPanel.js
**Location**: `frontend/src/components/PluginPanel.js`
**Purpose**: Interface for audio plugins and effects.

**Key Features**:
- Plugin browser
- Effect chain management
- Plugin parameter controls
- Preset management

#### 13. TrackClip.js
**Location**: `frontend/src/components/TrackClip.js`
**Purpose**: Visual representation of audio clips on tracks.

**Key Features**:
- Waveform display
- Clip selection and dragging
- Resize handles for trimming
- Fade curves visualization

#### 14. WaveformPlayer.js
**Location**: `frontend/src/components/WaveformPlayer.js`
**Purpose**: Audio waveform visualization and playback.

**Key Features**:
- Real-time waveform rendering
- Playback position indicator
- Zoom and scroll controls
- Multi-channel support

### Utility Components

#### 15. Sidebar.js
**Location**: `frontend/src/components/Sidebar.js`
**Purpose**: Generic sidebar container component.

#### 16. ProjectCard.js
**Location**: `frontend/src/components/ProjectCard.js`
**Purpose**: Card component for displaying project information.

## Backend Services

### FastAPI Application
**Location**: `backend/main.py`
**Purpose**: Main API server handling all backend operations.

**Key Features**:
- RESTful API endpoints
- User authentication and authorization
- Project data management
- File upload/download handling

### User Management
**Location**: `backend/models/user_model.py`, `backend/routers/users.py`
**Purpose**: User account management and authentication.

**Features**:
- User registration and login
- Profile management
- Session handling

### AI Models
**Location**: `ai_models/`
**Purpose**: Machine learning models for audio processing.

**Current Models**:
- LSTM model for audio generation (`train_lstm.py`)

## Key Features

### Project Management
- Create new projects with customizable settings
- Save and load project files
- Project browser with search functionality
- Automatic project backup

### Audio Engine
- Multi-track audio recording and playback
- Real-time audio processing
- High-quality audio rendering
- Support for various audio formats

### User Interface
- Modern, responsive design
- Dark theme optimized for audio work
- Resizable panels and customizable layout
- Keyboard shortcuts and mouse gestures

### Integration Features
- Electron desktop application
- Cross-platform compatibility (Windows, macOS, Linux)
- File system integration
- System tray support

## Project Structure

```
reson-studio/
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.js
│   │   │   ├── NewProjectModal.js
│   │   │   ├── SessionBrowser.js
│   │   │   ├── ProjectSidebar.js
│   │   │   ├── TransportBar.js
│   │   │   ├── Timeline.js
│   │   │   ├── TrackList.js
│   │   │   ├── Mixer.js
│   │   │   ├── Inspector.js
│   │   │   ├── PluginPanel.js
│   │   │   ├── TrackClip.js
│   │   │   ├── WaveformPlayer.js
│   │   │   ├── Sidebar.js
│   │   │   └── ProjectCard.js
│   │   ├── pages/
│   │   │   ├── Dashboard.js
│   │   │   └── Home.js
│   │   ├── styles/
│   │   │   └── daw.css
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   ├── electron/
│   │   ├── main.js
│   │   └── preload.js
│   ├── package.json
│   └── scripts/
│       └── copy-electron.js
├── backend/
│   ├── main.py
│   ├── models/
│   │   └── user_model.py
│   ├── routers/
│   │   └── users.py
│   └── requirements.txt
├── ai_models/
│   └── train_lstm.py
├── assets/
│   └── README.md
└── README.md
```

## Installation & Setup

### Prerequisites
- Node.js 16+
- Python 3.8+
- npm or yarn

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Electron Build
```bash
cd frontend
npm run build
npm run electron
```

## Usage Guide

### Creating a New Project
1. Click "New Project" in the navbar
2. Fill in project details (name, description, settings)
3. Click "Create Project"
4. Project appears in sidebar and projects view

### Working in Arrange View
1. Switch to "Arrange" view from navbar
2. Add tracks using the track list
3. Import audio files by dragging or using file menu
4. Arrange clips on the timeline
5. Use transport controls to play/pause

### Managing Projects
1. Switch to "Projects" view
2. Browse existing projects
3. Use search to find specific projects
4. Double-click to open a project

### Saving Work
1. Click "Save" button in navbar
2. Project data is saved to local storage/database
3. Automatic backups are created

## API Documentation

### User Endpoints

#### POST /users/register
Register a new user account.

**Request Body**:
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Response**:
```json
{
  "id": "integer",
  "username": "string",
  "email": "string",
  "created_at": "datetime"
}
```

#### POST /users/login
Authenticate user login.

**Request Body**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response**:
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "user": {
    "id": "integer",
    "username": "string",
    "email": "string"
  }
}
```

### Project Endpoints

#### GET /projects
Get list of user projects.

**Response**:
```json
[
  {
    "id": "integer",
    "name": "string",
    "description": "string",
    "bpm": "integer",
    "sample_rate": "integer",
    "bit_depth": "integer",
    "created_at": "datetime",
    "updated_at": "datetime"
  }
]
```

#### POST /projects
Create a new project.

**Request Body**:
```json
{
  "name": "string",
  "description": "string",
  "bpm": "integer",
  "sample_rate": "integer",
  "bit_depth": "integer"
}
```

#### PUT /projects/{project_id}
Update project information.

#### DELETE /projects/{project_id}
Delete a project.

## Development Notes

### State Management
The application uses React's built-in state management with `useState` hooks. For larger applications, consider implementing Redux or Context API for global state.

### Performance Considerations
- Audio processing is handled in Web Audio API for real-time performance
- Large waveform data is processed in chunks to prevent UI blocking
- Virtual scrolling is used for track lists with many tracks

### Extensibility
- Plugin system allows for third-party audio effects
- API-first design enables easy integration with external tools
- Modular component architecture supports easy feature additions

### Future Enhancements
- Real-time collaboration features
- Cloud storage integration
- Advanced audio effects processing
- MIDI support and virtual instruments
- Hardware controller integration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Join our community Discord

---

*Last updated: [Current Date]*
*Version: 1.0.0*
