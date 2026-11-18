const {test} = require('node:test');
const assert = require('node:assert/strict');
const {rank} = require('./events.js');

test('the 21 dated English event labels are recognized by their corresponding rule', () => {
  const catalogue = rank([]);
  assert.equal(catalogue.length, 21);
  for (const event of catalogue) {
    const example = {date:event.start, headline:event.labelEn};
    const result = rank([example]).find(row => row.id === event.id);
    assert.equal(result.count, 1, event.labelEn);
    assert.equal(result.frequency, 100);
    assert.match(result.sourceUrl, /^https:\/\/www\.(?:publicsenat|assemblee-nationale)\.fr\//);
    assert.equal(result.titles[0], example);
  }
});

test('period, window and coverage have separate denominators', () => {
  const entries = [
    {date:'2025-09-08',headline:'Après la chute du gouvernement Bayrou'},
    {date:'2025-09-08',headline:'Transports : les nouvelles lignes de métro'},
    {date:'2025-09-09',headline:'Bayrou a remis sa démission'},
    {date:'2026-11-01',headline:'Après la chute du gouvernement Bayrou'}
  ];
  const calendar = rank(entries,{start:'2025-09-01',end:'2026-10-31'});
  const bayrou = calendar.find(e => e.id === 'bayrou-chute');
  assert.equal(bayrou.windowTotal,2);
  assert.equal(bayrou.frequency,100/3);
  assert.equal(bayrou.windowFrequency,50);
  const dissolution = calendar.find(e => e.id === 'dissolution-2024');
  assert.equal(dissolution.coverage,'outside');
  assert.equal(dissolution.count,null);
  const protests = calendar.find(e => e.id === 'mobilisation-sept-2025');
  assert.equal(protests.coverage,'unobserved');
  assert.equal(protests.frequency,null);
});

test('a partial window can observe titles and still yield zero', () => {
  const data = [{date:'2025-09-12',headline:'Prix des billets de train'}];
  const protest = rank(data,{start:'2025-09-11',end:'2025-09-12'}).find(e=>e.id==='mobilisation-sept-2025');
  assert.equal(protest.coverage,'partial');
  assert.equal(protest.count,0);
  assert.equal(protest.frequency,0);
});

test('date alone and unrelated foreign/sectoral headlines cannot establish a hit', () => {
  const data = [
    {date:'2026-09-29',headline:'Blocus des lycées'},
    {date:'2026-10-17',headline:'Germany: nationwide protests escalate'},
    {date:'2026-10-23',headline:'Manifestation contre le RN à Orléans'},
    {date:'2026-10-24',headline:'Congrès du RN : les manifestants refusent l’extrême droite'},
    {date:'2026-10-31',headline:'Mobilisations sociales : Emmanuel Macron inaugure une exposition'},
    {date:'2026-10-01',headline:'Le Parlement européen présente le budget 2027 de l’Union européenne'}
  ];
  for (const entry of rank(data)) if (entry.windowTotal) assert.equal(entry.count,0,entry.id);
});
