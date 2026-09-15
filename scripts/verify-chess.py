"""Independently recheck shipped drills with python-chess and the bundled engine.
Install python-chess in a disposable environment. Run from any directory:
python scripts/verify-chess.py
This reads only public positions, never profiles; it takes several minutes.
"""
import json, concurrent.futures
from pathlib import Path
import chess, chess.engine
ROOT=Path(__file__).resolve().parents[1]
def verify(group):
 name,puzzles=group
 engine=chess.engine.SimpleEngine.popen_uci(['node',str(ROOT/'hub/vendor/stockfish/stockfish-18-lite-single.js')])
 try:
  for p in puzzles:
   b=chess.Board(p['setupFen']);assert b.is_valid(),p['id'];b.push_uci(p['setupMove']);assert b.fen()==p['fen'],p['id'];side=b.turn
   for i,u in enumerate(p['line']):
    m=chess.Move.from_uci(u);assert m in b.legal_moves,(p['id'],u)
    if i%2==0:
     after=b.copy();after.push(m)
     if not after.is_checkmate():
      engine.configure({'Clear Hash':None})
      analysis=engine.analyse(b,chess.engine.Limit(nodes=300000,depth=22),multipv=2)
      assert analysis[0]['pv'][0]==m,(p['id'],u,'best move changed')
      values=[a['score'].pov(side).score(mate_score=100000) for a in analysis]
      assert len(values)<2 or values[0]-values[1]>=65,(p['id'],u,'ambiguous')
    b.push(m)
   assert b.is_checkmate()==p['terminal'],p['id']
  print(name,len(puzzles),'verified',flush=True)
 finally:engine.quit()
groups=[]
for band,file in [('stretch','chess-puzzles.json'),('guided','chess-guided.json')]:
 for name,rows in json.loads((ROOT/'hub'/file).read_text()).items():groups.append((band+'/'+name,rows))
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(verify,groups))
print('All',sum(len(p) for _,p in groups),'positions verified.')
