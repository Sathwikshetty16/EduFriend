# EduFriend

EduFriend is a web-based application designed to enhance the learning experience for students and teachers. It provides features such as study materials, quizzes, performance tracking, and growth analytics. The application consists of a **frontend** built with React and a **backend** powered by Flask, integrated with Firebase for authentication and database management.

---

## Features

### Frontend
- **Splash Screen**: A visually appealing splash screen with animations.
- **Student Dashboard**: Displays study materials, quizzes, and performance analytics.
- **Login System**: Firebase-based authentication for secure login.
- **Responsive Design**: Optimized for both desktop and mobile devices.

### Backend
- **Flask API**: Provides endpoints for user authentication, study materials, and analytics.
- **Firebase Integration**: Manages user authentication and real-time database.
- **CORS Configuration**: Ensures secure communication between frontend and backend.
- **Cloud Run Deployment**: Backend is deployed on Google Cloud Run for scalability.

---

## Tech Stack

### Frontend
- **React**: JavaScript library for building user interfaces.
- **Firebase**: Authentication and database integration.
- **Axios**: For making API requests.
- **CSS**: Custom styles for a modern and responsive design.

### Backend
- **Flask**: Python web framework for building APIs.
- **Firebase Admin SDK**: For backend Firebase operations.
- **Google Cloud Run**: For deploying the backend as a serverless application.

---

## Installation

### Prerequisites
- **Node.js**: Install from [Node.js](https://nodejs.org/).
- **Python 3.9+**: Install from [Python](https://www.python.org/).
- **Google Cloud SDK**: Install from [Google Cloud SDK](https://cloud.google.com/sdk).

---
EduFriend/
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── Dashboard.js
│   │   │   └── SplashScreen.js
│   │   ├── App.js
│   │   └── index.js
│   ├── public/
│   ├── .env
│   ├── package.json
│   └── README.md

LiveDemo:https://edufriend-web-app.web.app/login

1. Navigate to the frontend directory:
   ```bash
   cd frontend
