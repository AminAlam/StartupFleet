import unittest
import json
import os
import sqlite3
import tempfile
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
        self.assertIn(b'BrightFleet', rv.data)

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
        new_state = DEFAULT_STATE.copy()
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
        # Save change
        new_state = DEFAULT_STATE.copy()
        new_state['teams'].append({"id": "t99", "name": "New Team"})
        
        self.client.post('/api/save', 
                         data=json.dumps(new_state),
                         content_type='application/json')
        
        # Load
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        self.assertEqual(len(data['teams']), len(DEFAULT_STATE['teams']) + 1)
        self.assertEqual(data['teams'][-1]['id'], "t99")

    def test_save_invalid_json(self):
        """Test saving malformed JSON returns 400 or handles error gracefully"""
        # Flask's get_json() handles malformed JSON automatically usually returning 400
        rv = self.client.post('/api/save', 
                              data="not a json",
                              content_type='application/json')
        # Expecting 400 Bad Request from Flask due to invalid JSON payload
        self.assertEqual(rv.status_code, 400)

if __name__ == '__main__':
    unittest.main()