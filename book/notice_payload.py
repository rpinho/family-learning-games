"""Build notice data without sending mail or reading account configuration."""
import json
from datetime import date


def read_payload(args, stream):
    if not args:
        return json.load(stream)
    if len(args) != 3 or args[0] != '--failure':
        raise ValueError('Expected --failure PLAYER YYYY-MM-DD')
    player, day = args[1:]
    date.fromisoformat(day)
    if not player or any(c in player for c in '\r\n'):
        raise ValueError('Expected a single-line player label')
    return {
        'subject': f'The Book — no quest today for {player} ({day})',
        'body': f'The {day} chapter for {player} did not publish after retry and fallback. '
                'The app shows "your quest is being built" until it is fixed. '
                'Check the Book deadline log.',
    }
