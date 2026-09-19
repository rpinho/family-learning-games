"""Independent python-chess check of original continuation drills (pip install python-chess)."""
import json
from pathlib import Path
import chess
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'hub/chess-continuation.json').read_text())
data['units'].update(json.loads((root/'hub/chess-sequel.json').read_text())['units'])
count=branches=0
for group in data['units'].values():
 for p in group['practice']+group['examples']:
  b=chess.Board(p['fen']);assert b.is_valid(),p['id'];assert not b.is_check();count+=1
  for u in p['line']:
   m=chess.Move.from_uci(u);assert m in b.legal_moves,(p['id'],u);b.push(m)
  if p['theme'] in ['stepsMateTwo','stepsMateNet']:assert b.is_checkmate(),p['id']
  for first,chosen in p.get('nextLines',{}).items():
   b=chess.Board(p['fen']);b.push_uci(first);assert b.is_check()
   replies=list(b.legal_moves);assert replies
   for reply in replies:
    b.push(reply);wins=[]
    for end in list(b.legal_moves):
     if not p['terminal'] and (b.piece_type_at(end.to_square)!=chess.ROOK or p['theme'].endswith('Win') and end.from_square!=chess.Move.from_uci(first).to_square):continue
     b.push(end)
     good=b.is_checkmate() if p['theme'] in ['stepsMateTwo','stepsMateNet'] else not any(m.to_square==end.to_square and b.is_capture(m) for m in b.legal_moves)
     if good:wins.append(end.uci())
     b.pop()
    assert wins,(p['id'],first,reply.uci())
    if reply.uci()==chosen['reply']:assert set(wins)==set(chosen['finishes'])
    branches+=1;b.pop()
print(f'Independent python-chess: {count} valid positions/examples; {branches} legal opponent replies verified.')
