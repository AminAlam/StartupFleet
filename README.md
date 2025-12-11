# Startup Fleet

A visual strategy tool that turns your company's goals, projects, and team allocations into an interactive naval map.

![2D Map Demo](demo/2D_map.gif)

## Quick Start

```bash
pip install flask
python app.py --port 8080
```

Open `http://localhost:8080`

## What It Does

- **Islands** = Projects/Expeditions  
- **Ships** = Team members you drag onto islands  
- **Main Goals** = Big objectives that islands connect to  
- **North Star** = Your company vision

Drag teams from the sidebar onto islands. Ships sail there automatically. Switch between 2D map, 3D view, and data matrix.

## Views

| View | Description |
|------|-------------|
| **2D Map** | Pan/zoom tactical view with drag-and-drop |
| **3D World** | Flyable ocean scene with waves and clouds |
| **Matrix** | Spreadsheet-style resource allocation view |

![3D View](demo/3D_map.gif)

![Matrix View](demo/Matrix_View.gif)

## Controls

| Action | Control |
|--------|---------|
| Pan | Right-click drag |
| Zoom | Scroll |
| Move island/goal | Left-click drag |
| Assign team | Drag team card onto island |
| Edit | Double-click any element |

## Data

State auto-saves to SQLite. Export/import JSON via the toolbar buttons.

```json
{
  "projectTitle": "My Fleet",
  "teams": [{ "id": "t1", "name": "Engineering", "totalShips": 10 }],
  "mainGoals": [{ "id": "mg1", "title": "Launch v2", "x": 0, "y": -600 }],
  "islands": [{ "id": "i1", "title": "Auth System", "mainGoalIds": ["mg1"] }]
}
```

## Stack

- **Backend**: Flask + SQLite
- **Frontend**: Vanilla JS, Canvas 2D, Three.js
- **No build step**. Just Python and a browser.

## License

MIT
