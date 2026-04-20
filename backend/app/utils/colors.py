"""Deterministic user color from UUID — same user always gets same color."""

PALETTE = [
    "#22d3ee",  # cyan
    "#a78bfa",  # violet
    "#34d399",  # emerald
    "#f472b6",  # pink
    "#fb923c",  # orange
    "#facc15",  # yellow
    "#60a5fa",  # blue
    "#f87171",  # red
]


def user_color(user_id: str) -> str:
    # Hash the user_id bytes to pick a stable index
    h = sum(ord(c) for c in user_id)
    return PALETTE[h % len(PALETTE)]
