import unittest
import json
import os
import sqlite3
import tempfile
import copy
from app import app, DEFAULT_STATE

class NorthStarTestCase(unittest.TestCase):
    def setUp(self):
        # Create a temp file for DB
        self.db_fd, self.db_path = tempfile.mkstemp()
        
        # Configure app
        app.config['TESTING'] = True
        
        # Patch the DB_FILE in the app module
        import app as app_module
        self.original_db_file = app_module.DB_FILE
        app_module.DB_FILE = self.db_path
        
        # Initialize DB
        app_module.init_db()
        
        self.client = app.test_client()

    def tearDown(self):
        os.close(self.db_fd)
        os.unlink(self.db_path)
        # Restore DB path
        import app as app_module
        app_module.DB_FILE = self.original_db_file

    def test_home(self):
        """Test home page loads"""
        rv = self.client.get('/')
        self.assertEqual(rv.status_code, 200)
        self.assertIn(b'Fleet', rv.data)

    def test_db_initialization(self):
        """Test DB creates default row on init"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT count(*) FROM gamestate")
            count = cursor.fetchone()[0]
            self.assertEqual(count, 1)

    def test_load_initial_state(self):
        """Test loading returns the default state initially"""
        rv = self.client.get('/api/load')
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data)
        
        # Check structure matches default state
        self.assertEqual(len(data['teams']), len(DEFAULT_STATE['teams']))
        self.assertEqual(data['mainGoals'][0]['id'], DEFAULT_STATE['mainGoals'][0]['id'])

    def test_save_game_success(self):
        """Test saving valid game state"""
        new_state = copy.deepcopy(DEFAULT_STATE)
        new_state['teams'][0]['name'] = "Renamed Team"
        
        rv = self.client.post('/api/save', 
                              data=json.dumps(new_state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        self.assertEqual(json.loads(rv.data)['status'], 'success')

        # Verify persistence
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT data FROM gamestate WHERE id=1")
            saved_json = cursor.fetchone()[0]
            saved_data = json.loads(saved_json)
            self.assertEqual(saved_data['teams'][0]['name'], "Renamed Team")

    def test_load_after_save(self):
        """Test loading retrieves the updated state"""
        # Save change - use deepcopy to avoid mutating global DEFAULT_STATE
        initial_len = len(DEFAULT_STATE['teams'])
        new_state = copy.deepcopy(DEFAULT_STATE)
        new_state['teams'].append({"id": "t99", "name": "New Team"})
        
        self.client.post('/api/save', 
                         data=json.dumps(new_state),
                         content_type='application/json')
        
        # Load
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        self.assertEqual(len(data['teams']), initial_len + 1)
        self.assertEqual(data['teams'][-1]['id'], "t99")

    def test_save_invalid_json(self):
        """Test saving malformed JSON returns error"""
        rv = self.client.post('/api/save', 
                              data="not a json",
                              content_type='application/json')
        # App catches exception and returns 500
        self.assertIn(rv.status_code, [400, 500])

    def test_save_empty_state(self):
        """Test saving empty state structure"""
        empty_state = {"teams": [], "islands": [], "mainGoals": []}
        rv = self.client.post('/api/save',
                              data=json.dumps(empty_state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        self.assertEqual(len(data['teams']), 0)

    def test_save_team_with_deployments(self):
        """Test saving team with multiple deployments"""
        state = copy.deepcopy(DEFAULT_STATE)
        
        # Add multiple deployments to same island with unique IDs
        state['teams'][0]['deployed'] = [
            {"deploymentId": "dep_1", "islandId": "e1", "kpiIds": ["k1"]},
            {"deploymentId": "dep_2", "islandId": "e1", "kpiIds": ["k1"]},
            {"deploymentId": "dep_3", "islandId": "e1", "kpiIds": ["k2"]}
        ]
        
        rv = self.client.post('/api/save',
                              data=json.dumps(state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        # Verify all deployments are saved
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        self.assertEqual(len(data['teams'][0]['deployed']), 3)
        
        # Verify deployment IDs are preserved
        deployment_ids = [d['deploymentId'] for d in data['teams'][0]['deployed']]
        self.assertIn('dep_1', deployment_ids)
        self.assertIn('dep_2', deployment_ids)
        self.assertIn('dep_3', deployment_ids)

    def test_save_island_with_kpis(self):
        """Test saving island with multiple KPIs"""
        state = copy.deepcopy(DEFAULT_STATE)
        
        # Add KPIs to first island
        state['islands'][0]['kpis'] = [
            {"id": "k1", "desc": "First KPI", "deadline": "2025-06-01", "completed": False},
            {"id": "k2", "desc": "Second KPI", "deadline": "2025-12-01", "completed": True}
        ]
        
        rv = self.client.post('/api/save',
                              data=json.dumps(state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        self.assertEqual(len(data['islands'][0]['kpis']), 2)
        self.assertEqual(data['islands'][0]['kpis'][1]['completed'], True)

    def test_save_island_with_multiple_main_goals(self):
        """Test saving island linked to multiple main goals"""
        state = copy.deepcopy(DEFAULT_STATE)
        
        # Link island to multiple main goals
        main_goal_ids = [mg['id'] for mg in state['mainGoals'][:2]]
        state['islands'][0]['mainGoalIds'] = main_goal_ids
        
        rv = self.client.post('/api/save',
                              data=json.dumps(state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        self.assertEqual(len(data['islands'][0]['mainGoalIds']), 2)

    def test_save_main_goal_with_description(self):
        """Test saving main goal with description"""
        state = copy.deepcopy(DEFAULT_STATE)
        state['mainGoals'][0]['desc'] = "This is a detailed description of the goal."
        
        rv = self.client.post('/api/save',
                              data=json.dumps(state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        self.assertEqual(data['mainGoals'][0]['desc'], "This is a detailed description of the goal.")

    def test_multiple_saves_overwrite(self):
        """Test that multiple saves properly overwrite previous state"""
        state1 = copy.deepcopy(DEFAULT_STATE)
        state1['teams'][0]['name'] = "First Save"
        
        rv = self.client.post('/api/save',
                              data=json.dumps(state1),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        state2 = copy.deepcopy(DEFAULT_STATE)
        state2['teams'][0]['name'] = "Second Save"
        
        rv = self.client.post('/api/save',
                              data=json.dumps(state2),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        self.assertEqual(data['teams'][0]['name'], "Second Save")

    def test_preserve_island_positions(self):
        """Test that island x,y positions are preserved"""
        state = copy.deepcopy(DEFAULT_STATE)
        state['islands'][0]['x'] = 500
        state['islands'][0]['y'] = -300
        
        rv = self.client.post('/api/save',
                              data=json.dumps(state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        self.assertEqual(data['islands'][0]['x'], 500)
        self.assertEqual(data['islands'][0]['y'], -300)

    def test_preserve_main_goal_positions(self):
        """Test that main goal x,y positions are preserved"""
        state = copy.deepcopy(DEFAULT_STATE)
        state['mainGoals'][0]['x'] = 250
        state['mainGoals'][0]['y'] = -800
        
        rv = self.client.post('/api/save',
                              data=json.dumps(state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        self.assertEqual(data['mainGoals'][0]['x'], 250)
        self.assertEqual(data['mainGoals'][0]['y'], -800)

    def test_large_state_handling(self):
        """Test handling of state with many entities"""
        state = copy.deepcopy(DEFAULT_STATE)
        
        # Add many teams
        for i in range(20):
            state['teams'].append({
                "id": f"t_extra_{i}",
                "name": f"Extra Team {i}",
                "totalShips": 3,
                "color": "#FF0000",
                "icon": "🚀",
                "deployed": []
            })
        
        # Add many islands
        for i in range(30):
            state['islands'].append({
                "id": f"i_extra_{i}",
                "title": f"Extra Island {i}",
                "x": i * 100,
                "y": i * 50,
                "icon": "🏝️",
                "kpis": [],
                "mainGoalIds": []
            })
        
        rv = self.client.post('/api/save',
                              data=json.dumps(state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        self.assertEqual(len(data['teams']), len(DEFAULT_STATE['teams']) + 20)
        self.assertEqual(len(data['islands']), len(DEFAULT_STATE['islands']) + 30)


class DeploymentLogicTestCase(unittest.TestCase):
    """Test cases specifically for multiple deployment feature"""
    
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp()
        app.config['TESTING'] = True
        import app as app_module
        self.original_db_file = app_module.DB_FILE
        app_module.DB_FILE = self.db_path
        app_module.init_db()
        self.client = app.test_client()

    def tearDown(self):
        os.close(self.db_fd)
        os.unlink(self.db_path)
        import app as app_module
        app_module.DB_FILE = self.original_db_file

    def test_multiple_identical_deployments(self):
        """Test that multiple identical deployments are preserved"""
        state = copy.deepcopy(DEFAULT_STATE)
        
        # Same team, same island, same KPIs - different deployment IDs
        state['teams'][0]['deployed'] = [
            {"deploymentId": "dep_a1", "islandId": "e1", "kpiIds": ["k1"]},
            {"deploymentId": "dep_a2", "islandId": "e1", "kpiIds": ["k1"]},
            {"deploymentId": "dep_a3", "islandId": "e1", "kpiIds": ["k1"]},
            {"deploymentId": "dep_a4", "islandId": "e1", "kpiIds": ["k1"]},
            {"deploymentId": "dep_a5", "islandId": "e1", "kpiIds": ["k1"]}
        ]
        
        rv = self.client.post('/api/save',
                              data=json.dumps(state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        
        # All 5 deployments should be preserved
        self.assertEqual(len(data['teams'][0]['deployed']), 5)
        
        # All should have unique deployment IDs
        dep_ids = [d['deploymentId'] for d in data['teams'][0]['deployed']]
        self.assertEqual(len(set(dep_ids)), 5)  # All unique

    def test_remove_single_deployment(self):
        """Test removing one deployment from multiple identical ones"""
        state = copy.deepcopy(DEFAULT_STATE)
        state['teams'][0]['deployed'] = [
            {"deploymentId": "dep_keep1", "islandId": "e1", "kpiIds": ["k1"]},
            {"deploymentId": "dep_remove", "islandId": "e1", "kpiIds": ["k1"]},
            {"deploymentId": "dep_keep2", "islandId": "e1", "kpiIds": ["k1"]}
        ]
        
        # Save initial state
        rv = self.client.post('/api/save',
                              data=json.dumps(state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        # Remove one deployment
        state['teams'][0]['deployed'] = [
            d for d in state['teams'][0]['deployed'] 
            if d['deploymentId'] != 'dep_remove'
        ]
        
        rv = self.client.post('/api/save',
                              data=json.dumps(state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        
        # Only 2 deployments should remain
        self.assertEqual(len(data['teams'][0]['deployed']), 2)
        dep_ids = [d['deploymentId'] for d in data['teams'][0]['deployed']]
        self.assertIn('dep_keep1', dep_ids)
        self.assertIn('dep_keep2', dep_ids)
        self.assertNotIn('dep_remove', dep_ids)

    def test_deployment_to_different_kpis(self):
        """Test deployments to different KPIs on same island"""
        state = copy.deepcopy(DEFAULT_STATE)
        state['teams'][0]['deployed'] = [
            {"deploymentId": "dep_1", "islandId": "e1", "kpiIds": ["k1"]},
            {"deploymentId": "dep_2", "islandId": "e1", "kpiIds": ["k2"]},
            {"deploymentId": "dep_3", "islandId": "e1", "kpiIds": ["k1", "k2"]}
        ]
        
        rv = self.client.post('/api/save',
                              data=json.dumps(state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        
        deployments = data['teams'][0]['deployed']
        self.assertEqual(len(deployments), 3)
        
        # Verify KPI assignments are preserved
        kpi_sets = [set(d['kpiIds']) for d in deployments]
        self.assertIn({'k1'}, kpi_sets)
        self.assertIn({'k2'}, kpi_sets)
        self.assertIn({'k1', 'k2'}, kpi_sets)


if __name__ == '__main__':
    unittest.main()
