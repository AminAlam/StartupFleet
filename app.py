import json
import os
import sqlite3
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)
DB_FILE = 'game.db'

# Rich Initial State with Strategy Data
DEFAULT_STATE = {
    "teams": [
        {"id": "t1", "name": "Engineering", "icon": "⚙️", "color": "#FF6B6B", "totalShips": 8, "deployed": []},
        {"id": "t2", "name": "Clinical", "icon": "🩺", "color": "#4ECDC4", "totalShips": 6, "deployed": []},
        {"id": "t3", "name": "Regulatory", "icon": "⚖️", "color": "#45B7D1", "totalShips": 4, "deployed": []},
        {"id": "t4", "name": "Market Access", "icon": "💰", "color": "#F7DC6F", "totalShips": 5, "deployed": []},
        {"id": "t5", "name": "Commercial", "icon": "📈", "color": "#BB8FCE", "totalShips": 7, "deployed": []},
        {"id": "t6", "name": "Operations", "icon": "🏗️", "color": "#F1948A", "totalShips": 6, "deployed": []}
    ],
    "mainGoals": [
        {
            "id": "mg1", "title": "US Commercial Launch 2028", "x": 0, "y": -600, 
            "icon": "🚀",
            "desc": "Achieve successful commercial launch in the US with Regulatory approval, Reimbursement >70%, and >1000 procedures/year."
        }
    ],
    "islands": [
        {
            "id": "p1", "mainGoalId": "mg1", "x": -400, "y": -100, "title": "Clinical Evidence", "icon": "📊",
            "desc": "Generate compelling clinical evidence demonstrating safety, efficacy, and economic value.",
            "kpis": [
                {"id": "k1_1", "desc": "Pivotal trial primary endpoint met", "deadline": "2026-06-01", "completed": False, "assigned": []},
                {"id": "k1_2", "desc": "Enrollment > 90% of plan", "deadline": "2025-12-01", "completed": False, "assigned": []},
                {"id": "k1_3", "desc": "Interim data milestones hit", "deadline": "2025-06-01", "completed": True, "assigned": []}
            ],
            "expanded": False
        },
        {
            "id": "p2", "mainGoalId": "mg1", "x": -250, "y": 150, "title": "Regulatory & Quality", "icon": "🏛️",
            "desc": "Obtain regulatory approvals supported by robust QMS and post-market plans.",
            "kpis": [
                {"id": "k2_1", "desc": "Key submissions filed on time (IDE)", "deadline": "2025-09-01", "completed": False, "assigned": []},
                {"id": "k2_2", "desc": "QMS fully implemented (ISO 13485)", "deadline": "2025-12-01", "completed": False, "assigned": []},
                {"id": "k2_3", "desc": "Zero major audit NCs", "deadline": "2026-01-01", "completed": False, "assigned": []}
            ],
            "expanded": False
        },
        {
            "id": "p3", "mainGoalId": "mg1", "x": 0, "y": 250, "title": "Market Access", "icon": "💲",
            "desc": "Secure sustainable reimbursement pathways for providers and payers.",
            "kpis": [
                {"id": "k3_1", "desc": "Completion of budget impact models", "deadline": "2026-03-01", "completed": False, "assigned": []},
                {"id": "k3_2", "desc": "Limited reimbursement agreements (3 sites)", "deadline": "2026-06-01", "completed": False, "assigned": []},
                {"id": "k3_3", "desc": "Time to payment < 45 days validation", "deadline": "2026-09-01", "completed": False, "assigned": []}
            ],
            "expanded": False
        },
        {
            "id": "p4", "mainGoalId": "mg1", "x": 250, "y": 150, "title": "Commercial Adoption", "icon": "🤝",
            "desc": "Drive meaningful adoption by early centers and build clinical advocacy.",
            "kpis": [
                {"id": "k4_1", "desc": "Sign 5 early adopter centers", "deadline": "2027-01-01", "completed": False, "assigned": []},
                {"id": "k4_2", "desc": "10 KOLs actively advocating", "deadline": "2026-12-01", "completed": False, "assigned": []},
                {"id": "k4_3", "desc": "Clinician training program live", "deadline": "2026-06-01", "completed": True, "assigned": []}
            ],
            "expanded": False
        },
        {
            "id": "p5", "mainGoalId": "mg1", "x": 400, "y": -100, "title": "Ops Readiness", "icon": "📦",
            "desc": "Build infrastructure to deliver and service the therapy at scale.",
            "kpis": [
                {"id": "k5_1", "desc": "Define order-to-delivery process", "deadline": "2026-02-01", "completed": False, "assigned": []},
                {"id": "k5_2", "desc": "Hire key field support roles", "deadline": "2026-04-01", "completed": False, "assigned": []},
                {"id": "k5_3", "desc": "Implement CRM & ERP basics", "deadline": "2025-11-01", "completed": True, "assigned": []}
            ],
            "expanded": False
        },
        {
            "id": "p6", "mainGoalId": "mg1", "x": 0, "y": -300, "title": "Product & Tech", "icon": "🔧",
            "desc": "Design and validate a device that is safe, effective, and manufacturable.",
            "kpis": [
                {"id": "k6_1", "desc": "Pivotal-grade design freeze", "deadline": "2025-08-01", "completed": False, "assigned": []},
                {"id": "k6_2", "desc": "Complete integrated prototype", "deadline": "2025-05-01", "completed": False, "assigned": []},
                {"id": "k6_3", "desc": "Close top 5 usability issues", "deadline": "2025-07-01", "completed": False, "assigned": []}
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)
