import os
from director.constants import DBType
from .base import BaseDB
from .sqlite.db import SQLiteDB
from .postgres.db import PostgresDB

db_types = {
    DBType.SQLITE: SQLiteDB,
    DBType.POSTGRES: PostgresDB,
}


def load_db(db_type: str = None) -> BaseDB:
    """Create a DB instance from env or provided type and ensure it's initialized.

    Accepts either a string (e.g., "sqlite", "postgres") or a DBType enum.
    Ensures tables are created by calling `health_check()` on first use.
    """
    # Resolve type from env if not provided
    if db_type is None:
        db_type = os.getenv("DB_TYPE", "sqlite").lower()

    # Normalize to DBType enum
    try:
        db_type_enum = DBType(db_type) if not isinstance(db_type, DBType) else db_type
    except ValueError:
        valid = [t.value for t in DBType]
        raise ValueError(f"Unknown DB type: {db_type}, valid types: {valid}")

    # Instantiate and run health check to initialize tables if needed
    db: BaseDB = db_types[db_type_enum]()
    try:
        db.health_check()
    except Exception:
        # Swallow initialization errors here; callers may still function and report errors themselves
        pass
    return db
