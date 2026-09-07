from pathlib import Path

path=Path('index.html')
s=path.read_text(encoding='utf-8')
old="const wrong=shuffle(allWords().filter(x=>x[3]!==w[3])).slice(0,3);"
new="const wrong=shuffle(qDeck.filter(x=>x[3]!==w[3])).slice(0,3);"
if old not in s:
    if new in s:
        print('Quiz same-deck fix already present.')
        raise SystemExit(0)
    raise RuntimeError('Could not find quiz distractor source')
s=s.replace(old,new,1)
path.write_text(s,encoding='utf-8')
print('Quiz distractors now come only from the current deck.')
