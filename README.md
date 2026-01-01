# Reson Studio

Reson Studio is a desktop audio processing application built with Electron, React, and FastAPI.

## Project Structure

The project is divided into two main parts:

- **frontend/**: A React application wrapped in Electron for the desktop interface.
- **backend/**: A Python FastAPI server handling the application logic and data processing.

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v14 or higher) & **npm**
- **Python** (v3.8 or higher) & **pip**

## Setup & Installation

### 1. Backend Setup

The backend is built using FastAPI.

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install the required Python dependencies:
   ```bash
   pip install fastapi uvicorn pydantic
   ```
   *(Note: It's recommended to use a virtual environment)*

3. Start the backend server:
   ```bash
   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   The API will be available at `http://localhost:8000`.

### 2. Frontend Setup

The frontend is a React app utilizing Electron.

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install the Node.js dependencies:
   ```bash
   npm install
   ```

## Running the Application

To run the full application, you need to have the backend server running, and then start the frontend.

1. **Start the Backend** (if not already running):
   ```bash
   # In terminal 1
   cd backend
   python -m uvicorn main:app --reload
   ```

2. **Start the Frontend (Electron + React)**:
   ```bash
   # In terminal 2
   cd frontend
   npm start
   ```

The `npm start` command will concurrently run the React development server and launch the Electron window.

## Development

- **Frontend Port**: 3000
- **Backend Port**: 8000

## Technologies

- **Frontend**: React 19, Electron , Tone.js, Wavesurfer.js
- **Backend**: FastAPI, Uvicorn
