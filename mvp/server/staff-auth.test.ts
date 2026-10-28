import assert from 'node:assert/strict';
import {test} from 'node:test';
import crypto from 'node:crypto';
import {verifyStaffToken} from './staff-auth.js';
const secret='test-only-secret-32-characters-minimum-123456789';
const now=1800000000;
function token(claims:Record<string,unknown>,key=secret,header={alg:'HS256',typ:'JWT'}){
 const h=Buffer.from(JSON.stringify(header)).toString('base64url');
 const p=Buffer.from(JSON.stringify(claims)).toString('base64url');
 const signature=crypto.createHmac('sha256',key).update(h+'.'+p).digest('base64url');
 return h+'.'+p+'.'+signature;
}
const valid={iss:'cl360-xpay',aud:'cl360-xpay-staff',sub:'staff-1',workspaceId:'careerLift360',role:'finance',exp:now+600};
test('accepts valid signed staff identity',()=>assert.equal(verifyStaffToken(token(valid),secret,now).role,'finance'));
test('rejects wrong signature',()=>assert.throws(()=>verifyStaffToken(token(valid,'another-secret-32-characters-minimum-98765'),secret,now),/signature/));
test('rejects expired token',()=>assert.throws(()=>verifyStaffToken(token({...valid,exp:now-1}),secret,now),/expired/));
test('rejects wrong audience',()=>assert.throws(()=>verifyStaffToken(token({...valid,aud:'other-app'}),secret,now),/issuer or audience/));
test('rejects cross-workspace token',()=>assert.throws(()=>verifyStaffToken(token({...valid,workspaceId:'other'}),secret,now),/workspace/));
test('rejects excessive token lifetime',()=>assert.throws(()=>verifyStaffToken(token({...valid,exp:now+7200}),secret,now),/one-hour/));
test('rejects algorithm substitution',()=>assert.throws(()=>verifyStaffToken(token(valid,secret,{alg:'none',typ:'JWT'}),secret,now),/algorithm/));
