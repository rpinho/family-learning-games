"""Independent python-chess check of the full-board Small steps bridge."""
import json
from pathlib import Path
import chess

root=Path(__file__).resolve().parents[1]
bridge=json.loads((root/'hub/chess-bridge.json').read_text())
guided=json.loads((root/'hub/chess-guided.json').read_text())
stretch=json.loads((root/'hub/chess-puzzles.json').read_text())
sources={p['id']:p for pools in (guided,stretch) for group in pools.values() for p in group}
practice=examples=0
ids=set();fens=set()
for group in bridge['units'].values():
 for kind in ('practice','examples'):
  for p in group[kind]:
   source=sources[p['sourceId']]
   assert p['id'] not in ids and p['fen'] not in fens,p['id']
   ids.add(p['id']);fens.add(p['fen'])
   for key in ('fen','line','rating','checks','terminal'):
    assert p[key]==source[key],(p['id'],key)
   board=chess.Board(p['fen']);assert board.is_valid(),p['id']
   for uci in p['line']:
    move=chess.Move.from_uci(uci);assert move in board.legal_moves,(p['id'],uci);board.push(move)
   if p['terminal']:assert board.is_checkmate(),p['id']
   if kind=='practice':practice+=1
   else:examples+=1
assert (practice,examples)==(270,54),(practice,examples)
print(f'Independent python-chess: {practice} bridge positions and {examples} examples match validated sources and have legal lines.')
