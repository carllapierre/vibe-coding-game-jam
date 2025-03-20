from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os

app = Flask(__name__)
CORS(app)

WORLD_DATA_PATH = 'public/data/world.json'

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
        
        # Create backup of current world data
        if os.path.exists(WORLD_DATA_PATH):
            with open(WORLD_DATA_PATH + '.bak', 'w') as f:
                json.dump(json.load(open(WORLD_DATA_PATH)), f, indent=4)
        
        # Save new world data
        with open(WORLD_DATA_PATH, 'w') as f:
            json.dump(data, f, indent=4)
        
        return jsonify({'message': 'World data saved successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True) 