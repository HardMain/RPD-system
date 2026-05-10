from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, DateTime, ForeignKey, Index,
)
from sqlalchemy.sql import func

from app.core.database import Base


class DictionaryEntry(Base):
    __tablename__ = "dictionary_entries"
    id_entry = Column(BigInteger, primary_key=True, autoincrement=True)
    kind = Column(String(40), nullable=False, index=True)
    value = Column(Text, nullable=False)
    source_type = Column(String(120), nullable=True)
    mode = Column(String(20), nullable=True)
    source = Column(String(20), nullable=False, default="manual")
    created_by = Column(Integer, ForeignKey("users.id_user"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_dictionary_entries_kind_value", "kind", "value"),
    )
