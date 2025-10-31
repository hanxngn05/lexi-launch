SpatioSense

**A minimal guide to get the app running for the first time (not including the server).**

----------------------------------------------------
Prerequisites
- Node 18+ and npm
- Python 3.10+

Project structure
- React Native app (Expo) lives in this repo
- Python Flask server lives in `server.py` (server desktop)

App output: The app is currently configured to run in development build

Files for server:
* database_utils.py
* gemini.py
* server.py
* sentiment_analysis.py
* task_assignment.py
* task_config.py
* task_creation.py

1) Install app dependencies
```
npm install
```

2) Configure the mobile app
- iOS ATS is already configured in `app.json` for direct IP access. (missing android and web)

3) Start the app
Step 1: Start the app
```
npx expo start
```
Step 2: To open IOS simulator, enter ```i``` in the terminal once you see a Barcode.
# lexi-launch
