# RoommateCourt

Roommate Court is a web application designed to turn common roommate conflicts into a more structured and entertaining resolution process. Instead of unresolved tension or awkward confrontations, users can formally submit disputes into a shared “courtroom” where each side presents their case. Most roommates have issues with stolen food, noise complaints, or cleaning issues that they struggle to bring up with the people they share a living space with. The platform introduces a lighthearted but organized system that encourages communication, fairness, and accountability among roommates.

## Features
- detailed descriptions and evidence uploads (photos, messages)
- a jury system where selected friends or housemates can vote on the outcome
- an automated “judge” that delivers a final verdict based on submissions and votes.
- Users can track
    - past cases
    - view rulings
    - build a history of decisions within their household. 
    
## AI Usage Documentation

This project used Claude as an AI assistant during development. The following contributions were generated with Claude's assistance:

**Dashboard Buttons**
- Added "Create Household" and "Open Case" buttons to the Dashboard
- Styled buttons to perfectly match the app's existing blue color palette

**Notification System**
- Created `src/utils/notificationsService.js` with real-time Firestore notifications
- Notification bell with unread badge, dropdown panel, and read/unread state
- Handles three notification types: case filed, jury selection, and verdict delivered

**Case Submission → Case Review Routing**
- Rerouted case submission to display a Case Review page after saving to Firebase
- Case Review loads real data from Firebase and shows a confirmation banner
- Added "Back to Dashboard" and "Open the Court" actions on the review page
