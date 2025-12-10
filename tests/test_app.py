import unittest
import json
import os
import sqlite3
import tempfile
from app import app, DEFAULT_STATE

class NorthStarTestCase(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp()
        
        # Configure app to use temp db
        app.config['TESTING'] = True
        
        # Patch the DB_FILE in the app module (simple way for this structure)
        import app as app_module
        self.original_db_file = app_module.DB_FILE
        app_module.DB_FILE = self.db_path
        
        # Initialize DB
        app_module.init_db()
        
        self.client = app.test_client()

    def tearDown(self):
        os.close(self.db_fd)
        os.unlink(self.db_path)
        # Restore
        import app as app_module
        app_module.DB_FILE = self.original_db_file

    def test_home(self):
        rv = self.client.get('/')
        self.assertEqual(rv.status_code, 200)
        self.assertIn(b'BrightFleet', rv.data)

    def test_load_initial(self):
        rv = self.client.get('/api/load')
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data)
        self.assertEqual(len(data['teams']), len(DEFAULT_STATE['teams']))

    def test_save_and_load(self):
        # Create a new state
        new_state = DEFAULT_STATE.copy()
        new_state['teams'][0]['name'] = "Test Team Alpha"
        
        # Save
        rv = self.client.post('/api/save', 
                              data=json.dumps(new_state),
                              content_type='application/json')
        self.assertEqual(rv.status_code, 200)
        
        # Load back
        rv = self.client.get('/api/load')
        data = json.loads(rv.data)
        self.assertEqual(data['teams'][0]['name'], "Test Team Alpha")

if __name__ == '__main__':
    unittest.main()
