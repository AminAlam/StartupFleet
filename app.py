import json
import os
import sqlite3
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)
DB_FILE = 'game.db'

# Rich Initial State with Strategy Data
DEFAULT_STATE = {
    "projectTitle": "Startup Fleet Demo",
    "teams": [
        {"id": "t1", "name": "Engineering", "icon": "⚙️", "color": "#FF6B6B", "totalShips": 12, "deployed": [
            {"deploymentId": "dep_t1_1", "islandId": "p1", "kpiIds": ["k1_1", "k1_2"]}
        ]},
        {"id": "t2", "name": "Product", "icon": "💡", "color": "#4ECDC4", "totalShips": 6, "deployed": [
            {"deploymentId": "dep_t2_1", "islandId": "p1", "kpiIds": ["k1_3"]}
        ]},
        {"id": "t3", "name": "Design", "icon": "🎨", "color": "#45B7D1", "totalShips": 4, "deployed": []},
        {"id": "t4", "name": "Marketing", "icon": "📣", "color": "#F7DC6F", "totalShips": 8, "deployed": [
            {"deploymentId": "dep_t4_1", "islandId": "p4", "kpiIds": ["k4_2"]}
        ]},
        {"id": "t5", "name": "Sales", "icon": "💼", "color": "#BB8FCE", "totalShips": 10, "deployed": [
            {"deploymentId": "dep_t5_1", "islandId": "p3", "kpiIds": ["k3_1"]}
        ]},
        {"id": "t6", "name": "Success", "icon": "🤝", "color": "#F1948A", "totalShips": 6, "deployed": []},
        {"id": "t7", "name": "Ops & Finance", "icon": "🏦", "color": "#90A4AE", "totalShips": 4, "deployed": []}
    ],
    "mainGoals": [
        {
            "id": "mg1", "title": "$100M ARR (Unicorn)", "x": -250, "y": -600, 
            "icon": "🦄",
            "desc": "Achieve unicorn status by hitting $100M Annual Recurring Revenue with strong unit economics."
        },
        {
            "id": "mg2", "title": "Category Leadership", "x": 250, "y": -600,
            "icon": "👑",
            "desc": "Establish undisputed market leadership through product innovation and brand dominance."
        }
    ],
    "islands": [
        {
            "id": "p1", "mainGoalId": "mg2", "x": -400, "y": -100, "title": "Platform 2.0", "icon": "🚀",
            "desc": "Launch the next-generation AI-powered platform to increase retention and upsell.",
            "kpis": [
                {"id": "k1_1", "desc": "Beta Launch with 50 customers", "deadline": "2026-03-01", "completed": True, "assigned": []},
                {"id": "k1_2", "desc": "99.99% Uptime SLA", "deadline": "2026-06-01", "completed": False, "assigned": []},
                {"id": "k1_3", "desc": "Migrate 80% of legacy users", "deadline": "2026-12-01", "completed": False, "assigned": []}
            ],
            "expanded": False
        },
        {
            "id": "p2", "mainGoalId": "mg1", "x": -200, "y": 150, "title": "Global Expansion", "icon": "🌍",
            "desc": "Expand footprint into EMEA and APAC regions to drive new logo acquisition.",
            "kpis": [
                {"id": "k2_1", "desc": "Hire EMEA Sales VP", "deadline": "2025-09-01", "completed": False, "assigned": []},
                {"id": "k2_2", "desc": "Open London Office", "deadline": "2025-11-01", "completed": True, "assigned": []},
                {"id": "k2_3", "desc": "$5M ARR from APAC", "deadline": "2026-06-01", "completed": False, "assigned": []}
            ],
            "expanded": False
        },
        {
            "id": "p3", "mainGoalId": "mg1", "x": 200, "y": 150, "title": "Enterprise Sales", "icon": "🏙️",
            "desc": "Move upmarket to close Fortune 500 deals with higher ACV.",
            "kpis": [
                {"id": "k3_1", "desc": "Close 10 Fortune 500 deals", "deadline": "2026-06-01", "completed": False, "assigned": []},
                {"id": "k3_2", "desc": "SOC2 Type II Compliance", "deadline": "2025-12-01", "completed": True, "assigned": []}
            ],
            "expanded": False
        },
        {
            "id": "p4", "mainGoalId": "mg2", "x": 400, "y": -100, "title": "Community & Brand", "icon": "❤️",
            "desc": "Build a defensible moat through community engagement and thought leadership.",
            "kpis": [
                {"id": "k4_1", "desc": "Host Annual User Conference", "deadline": "2026-05-01", "completed": False, "assigned": []},
                {"id": "k4_2", "desc": "10k Discord Members", "deadline": "2025-12-01", "completed": True, "assigned": []},
                {"id": "k4_3", "desc": "Launch Academy/Certification", "deadline": "2026-01-01", "completed": False, "assigned": []}
            ],
            "expanded": False
        }
    ]
}

def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS gamestate (
            id INTEGER PRIMARY KEY,
            data TEXT
        )''')
        # Insert default row if empty
        cursor = conn.cursor()
        cursor.execute("SELECT count(*) FROM gamestate")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO gamestate (id, data) VALUES (1, ?)", (json.dumps(DEFAULT_STATE),))
        conn.commit()

init_db()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/load', methods=['GET'])
def load_game():
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT data FROM gamestate WHERE id=1")
        row = cursor.fetchone()
        if row:
            return jsonify(json.loads(row[0]))
    return jsonify(DEFAULT_STATE)

@app.route('/api/save', methods=['POST'])
def save_game():
    try:
        state = request.json
        with sqlite3.connect(DB_FILE) as conn:
            conn.execute("UPDATE gamestate SET data=? WHERE id=1", (json.dumps(state),))
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

import argparse

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Startup Fleet Server')
    parser.add_argument('--port', type=int, default=5000, help='Port to run the server on')
    args = parser.parse_args()
    
    app.run(debug=True, port=args.port)
