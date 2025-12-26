from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from core.database import Base

class UserORM(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=True)

class ProjectORM(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    data_json = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TrackORM(Base):
    __tablename__ = "tracks"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True, nullable=False)
    name = Column(String(255), nullable=False, default="Track")
    audio_file_id = Column(String(64), nullable=False, default="")
    start_sec = Column(Float, nullable=False, default=0.0)
    gain = Column(Float, nullable=False, default=1.0)

class AISuggestionORM(Base):
    __tablename__ = "ai_suggestions"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True, nullable=False)
    kind = Column(String(50), nullable=False)
    input_json = Column(Text, nullable=False)
    output_json = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
