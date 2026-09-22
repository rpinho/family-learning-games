"""Independently verify short real-board practice. Requires python-chess.

Run python scripts/verify-chess-practice.py for legality, limits and provenance
fields; add --engine to repeat the per-learner-move Stockfish uniqueness checks.
Only public puzzle data is read. No profile or network access.
"""
import argparse
import concurrent.futures
import json
from pathlib import Path
import chess
import chess.engine

parser = argparse.ArgumentParser()
parser.add_argument('--engine', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'hub/chess-practice.json').read_text())
groups = list(data['units'].items())
all_positions = [p for _, group in groups for kind in ('practice', 'examples') for p in group[kind]]
assert len(groups) == 27 and len(all_positions) == 486
assert len({p['id'] for p in all_positions}) == 486
assert len({p['sourceId'] for p in all_positions}) == 486
assert len({p['fen'].split()[0] for p in all_positions}) == 486

def verify(item):
    name, group = item
    assert len(group['practice']) == 15 and len(group['examples']) == 3
    engine = chess.engine.SimpleEngine.popen_uci(['node', str(root / 'hub/vendor/stockfish/stockfish-18-lite-single.js')]) if args.engine else None
    try:
        for p in group['practice'] + group['examples']:
            assert 450 <= p['rating'] <= 1100 and p['popularity'] >= 90
            assert p['plays'] >= 300 and p['deviation'] <= 85
            b = chess.Board(p['setupFen'])
            assert b.is_valid() and chess.Move.from_uci(p['setupMove']) in b.legal_moves
            b.push_uci(p['setupMove'])
            assert b.fen() == p['fen'] and b.is_valid()
            assert len(b.piece_map()) <= 16 and len(p['line']) in (1, 3)
            assert len(p['checks']) == (len(p['line']) + 1) // 2
            for i, uci in enumerate(p['line']):
                move = chess.Move.from_uci(uci)
                assert move in b.legal_moves, (p['id'], uci)
                assert b.san(move) == p['san'][i]
                if i % 2 == 0:
                    after = b.copy(); after.push(move)
                    check = p['checks'][i // 2]
                    assert after.is_checkmate() if check.get('immediateMate') else check['gap'] >= 65
                    if engine and not after.is_checkmate():
                        engine.configure({'Clear Hash': None})
                        result = engine.analyse(b, chess.engine.Limit(nodes=300000, depth=22), multipv=2)
                        assert result[0]['pv'][0] == move, (p['id'], uci, 'best move')
                        values = [r['score'].pov(b.turn).score(mate_score=100000) for r in result]
                        assert len(values) < 2 or values[0] - values[1] >= 65, (p['id'], 'ambiguous')
                b.push(move)
            assert b.is_checkmate() == p['terminal'], p['id']
        print(name, '18 positions verified', flush=True)
    finally:
        if engine: engine.quit()

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    list(pool.map(verify, groups))
print('Verified 405 practice positions and 81 distinct examples' + (' with Stockfish.' if args.engine else '.'))
