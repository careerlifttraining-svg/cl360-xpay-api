import crypto from 'node:crypto';
import type {Request,Response,NextFunction} from 'express';

export type StaffRole='admin'|'finance'|'support'|'viewer';
const validRoles:StaffRole[]=['admin','finance','support','viewer'];
type AuthClaims={sub:string;workspaceId:string;role:StaffRole;iss:string;aud:string;exp:number;nbf?:number};

/** Explicit opt-in, short-lived, server-to-server HMAC tokens for staff API.
 * Do not expose XPAY_STAFF_TOKEN_SECRET to browsers or client bundles.
 * Interactive user login requires a separate OIDC session integration. */
function decode(input:string):Record<string,unknown>{
 const value=JSON.parse(Buffer.from(input,'base64url').toString('utf8'));
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid token claims');
 return value as Record<string,unknown>;
}
export function verifyStaffToken(token:string,secret:string,now=Math.floor(Date.now()/1000)):AuthClaims{
 if(!secret||Buffer.byteLength(secret)<32)throw new Error('Staff token verifier not configured');
 const parts=token.split('.');
 if(parts.length!==3)throw new Error('Invalid token structure');
 const [header,payload,signature]=parts;
 const meta=decode(header);
 if(meta.alg!=='HS256'||meta.typ!=='JWT')throw new Error('Unsupported token algorithm');
 const expected=crypto.createHmac('sha256',secret).update(header+'.'+payload).digest();
 const actual=Buffer.from(signature,'base64url');
 if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))throw new Error('Invalid token signature');
 const claims=decode(payload);
 if(claims.iss!=='cl360-xpay'||claims.aud!=='cl360-xpay-staff')throw new Error('Invalid token issuer or audience');
 if(typeof claims.sub!=='string'||!claims.sub.trim()||claims.workspaceId!=='careerLift360')throw new Error('Invalid staff identity or workspace');
 if(!validRoles.includes(claims.role as StaffRole))throw new Error('Invalid staff role');
 if(typeof claims.exp!=='number'||!Number.isInteger(claims.exp)||claims.exp<=now||claims.exp>now+3600)throw new Error('Token expired or exceeds one-hour lifetime');
 if(claims.nbf!==undefined&&(typeof claims.nbf!=='number'||claims.nbf>now+30))throw new Error('Token not yet valid');
 return claims as AuthClaims;
}
export function requireStaffRole(...allowed:StaffRole[]){
 return (req:Request,res:Response,next:NextFunction)=>{
  if(process.env.XPAY_STAFF_AUTH_ENABLED!=='true')return res.status(503).json({error:'Staff authentication is not enabled'});
  const match=/^Bearer (\S+)$/.exec(req.header('authorization')||'');
  if(!match)return res.status(401).json({error:'Staff bearer token required'});
  try{
   const claims=verifyStaffToken(match[1],process.env.XPAY_STAFF_TOKEN_SECRET||'');
   if(!allowed.includes(claims.role))return res.status(403).json({error:'Insufficient role'});
   res.locals.staff={subject:claims.sub,role:claims.role,workspaceId:claims.workspaceId};
   return next();
  }catch{return res.status(401).json({error:'Invalid staff credentials'});}
 };
}
