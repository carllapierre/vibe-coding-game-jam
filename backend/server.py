from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os

app = Flask(__name__)
# For development environments only - allows all origins
CORS(app, resources={r"/api/*": {"origins": "*"}})

WORLD_DATA_PATH = './data/world.json'

@app.route('/api/world', methods=['GET'])
def get_world():
    try:
        with open(WORLD_DATA_PATH, 'r') as f:
            return jsonify(json.load(f))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/world', methods=['POST'])
def save_world():
    try:
        data = request.get_json()
        print(f"Received world data update: {len(data.get('objects', []))} objects, {len(data.get('spawners', []))} spawners")
        
        # Log a sample of the objects
        if data.get('objects'):
            print(f"First 3 objects: {[obj['id'] for obj in data.get('objects', [])][:3]}")
            
            # Count total instances
            total_instances = sum(len(obj.get('instances', [])) for obj in data.get('objects', []))
            print(f"Total instances across all objects: {total_instances}")
        
        # Create backup of current world data
        if os.path.exists(WORLD_DATA_PATH):
            with open(WORLD_DATA_PATH + '.bak', 'w') as f:
                with open(WORLD_DATA_PATH, 'r') as orig:
                    orig_data = json.load(orig)
                    print(f"Creating backup of original data: {len(orig_data.get('objects', []))} objects")
                    json.dump(orig_data, f, indent=4)
        
        # Save new world data
        with open(WORLD_DATA_PATH, 'w') as f:
            json.dump(data, f, indent=4)
            print(f"World data saved successfully to {WORLD_DATA_PATH}")
        
        return jsonify({'message': 'World data saved successfully'})
    except Exception as e:
        print(f"Error saving world data: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True) 