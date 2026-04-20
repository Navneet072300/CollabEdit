from fastapi import FastAPI, WebSocket, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.api.rooms import router as rooms_router
from app.api.files import router as files_router
from app.api.execute import router as execute_router
from app.ws.handlers import handle_websocket

app = FastAPI(title="Collab Editor API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms_router)
app.include_router(files_router)
app.include_router(execute_router)


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    user_id: str,
    user_name: str,
    db: AsyncSession = Depends(get_db),
):
    await handle_websocket(websocket, room_id, user_id, user_name, db)


@app.get("/health")
async def health():
    return {"status": "ok"}
