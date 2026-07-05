# Custom Notebook

A full-stack application combining a React frontend with a Python FastAPI backend for managing notes and research topics.

## Project Structure

```
├── backend/          # FastAPI server
│   ├── main.py       # Application entry point
│   ├── auth.py       # Authentication logic
│   ├── database.py   # Database configuration
│   ├── llm.py        # LLM integration
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/         # React + Vite application
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/     # Redux store
│   │   └── tests/
│   ├── package.json
│   └── Dockerfile
└── README.md
```

## Features

- **Authentication**: Secure user authentication system
- **Chat Interface**: Real-time chat and research capabilities
- **Note Management**: Save and organize research notes
- **Theme Support**: Light/dark theme switching
- **Responsive Design**: Built with Tailwind CSS
- **Type Safety**: Redux for state management

## Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **Python**: Language runtime

### Frontend
- **React**: UI library
- **Vite**: Build tool
- **Redux**: State management
- **Tailwind CSS**: Styling
- **Nginx**: Web server (in Docker)

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 16+ (for local frontend development)
- Python 3.9+ (for local backend development)

### Running with Docker

```bash
# Backend
cd backend
docker-compose up

# Frontend (in another terminal)
cd frontend
docker-compose up
```

### Local Development

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python main.py
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

The backend provides various endpoints for:
- User authentication and management
- Chat and conversation handling
- Topic and note management
- LLM integration

## Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!
