from sqlalchemy import Column, Integer, String, BigInteger, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base

class StoredFile(Base):
    __tablename__ = "stored_files"
    id_file = Column(Integer, primary_key=True, autoincrement=True)
    kind = Column(String(30), nullable=False)
    original_name = Column(String(300), nullable=False)
    mime = Column(String(120))
    size_bytes = Column(BigInteger)
    storage_uri = Column(String(500), nullable=False)
    id_uploaded_by = Column(Integer, ForeignKey("users.id_user"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    uploaded_by = relationship("User", foreign_keys=[id_uploaded_by])
