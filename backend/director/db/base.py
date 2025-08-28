from abc import ABC, abstractmethod


class BaseDB(ABC):
    """Interface for all databases. It provides a common interface for all databases to follow."""

    @abstractmethod
    def create_session(
        self, session_id: str, video_id: str = None, collection_id: str = None
    ) -> None:
        """Create a new session."""
        pass

    @abstractmethod
    def get_session(self, session_id: str) -> dict:
        """Get a session by session_id."""
        pass

    @abstractmethod
    def get_sessions(self) -> list:
        """Get all sessions."""
        pass

    @abstractmethod
    def add_or_update_msg_to_conv(
        self,
        session_id: str,
        conv_id: str,
        msg_id: str,
        msg_type: str,
        agents: list,
        actions: list,
        content: list,
        status: str | None = None,
        created_at: int | None = None,
        updated_at: int | None = None,
        metadata: dict = {},
        **kwargs,
    ) -> None:
        """Add or update a message (input or output) in the conversation history."""
        pass

    @abstractmethod
    def get_conversations(self, session_id: str) -> list:
        """Get all conversations for a given session."""
        pass

    @abstractmethod
    def get_context_messages(self, session_id: str) -> dict:
        """Get context messages for a session.

        Should return a dict payload (e.g., {"reasoning": [...]}) suitable for
        `Session.get_context_messages()` which accesses `.get("reasoning", [])`.
        """
        pass

    @abstractmethod
    def add_or_update_context_msg(
        self, session_id: str, context_messages: dict
    ) -> None:
        """Update context messages for a session.

        Expects a dict payload (for example: {"reasoning": [...]}) which will be
        stored in the DB as JSON.
        """
        pass

    @abstractmethod
    def health_check(self) -> bool:
        """Check if the database is healthy."""
        pass
