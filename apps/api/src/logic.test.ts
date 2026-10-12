import test from 'node:test';
import assert from 'node:assert/strict';
import { inclusiveDays, sitterCanRespond, ownerCanCancel } from './logic.js';

test('duration includes both dates',()=>{
  assert.equal(inclusiveDays('2026-10-12','2026-10-12'),1);
  assert.equal(inclusiveDays('2026-10-12','2026-10-14'),3);
});
test('duration handles leap years and invalid ranges',()=>{
  assert.equal(inclusiveDays('2028-02-28','2028-03-01'),3);
  assert.equal(inclusiveDays('2026-10-14','2026-10-12'),-1);
});
test('booking state transitions',()=>{
  assert.equal(sitterCanRespond('pending'),true);
  assert.equal(sitterCanRespond('accepted'),false);
  assert.equal(ownerCanCancel('pending'),true);
  assert.equal(ownerCanCancel('accepted'),true);
  assert.equal(ownerCanCancel('completed'),false);
});
